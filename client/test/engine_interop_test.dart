// Real end-to-end interop + journey tests against the actual Go engine. Beyond the
// pairing + snapshot + telemetry + robustness path, this drives the four Phase-1
// realized journeys (Deep Dive §13 / PROJ-302) over the live engine + the client's
// net/render layers:
//
//   J0 pairing      — discover/payload → token pair → fingerprint verify → live deck.
//   J1 author-live  — apply a layout op placing a gauge → reflects on the device,
//                     asserting the apply→reflect latency is <200ms (in-process).
//   J2 gaming-start — invoke a launcher action → launches (dry-run) + telemetry stays
//                     live (gauge state keeps flowing).
//   J6 permissioned — a restricted 2nd device's power action is DENIED engine-side and
//                     AUDITED (ties AC P1-AC-07).
//
// plus the original robustness path: drop → TOKENLESS auto-reconnect (the engine
// recognises the known device) → revoke (via the engine console) drops the live
// session and blocks re-entry.
//
// Needs the built engine; set CYBERDECK_ENGINE to its exe path (plugins/ resolved
// next to it). Without it the tests skip, so `flutter test` stays green.
//
//   run/ layout:  run/cyberdeck.exe  +  run/plugins/{telemetry,power,volume,launchers}/*
//   flutter test test/engine_interop_test.dart   (with CYBERDECK_ENGINE set)
//   — or —  task interop
@TestOn('vm')
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:cyberdeck_client/designer/op_model.dart';
import 'package:cyberdeck_client/net/connection_manager.dart';
import 'package:cyberdeck_client/net/envelope.dart';
import 'package:cyberdeck_client/net/layout_apply.dart';
import 'package:cyberdeck_client/net/pairing.dart';
import 'package:cyberdeck_client/render/render.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final enginePath = Platform.environment['CYBERDECK_ENGINE'];
  final skip = enginePath == null
      ? 'set CYBERDECK_ENGINE to the built engine exe to run the live interop test'
      : false;

  // --- J0: pairing — discover/payload → verify → live ----------------------------
  test('J0 pairing: payload → token pair → fingerprint verify → live deck',
      () async {
    final eng = await _Engine.start(enginePath!, port: 8810);
    try {
      final payload = await eng.pairingPayload();

      // Pair with the single-use token from the QR/payload, asserting the engine's
      // served fingerprint matches the one the payload advertised (anti-MITM).
      final conn = await eng.cm
          .connect(
              host: '127.0.0.1',
              port: eng.port,
              token: payload.token,
              expectedFingerprint: payload.fingerprint)
          .timeout(const Duration(seconds: 15));
      expect(conn.engineFingerprint, payload.fingerprint,
          reason: 'served fingerprint must match the paired (QR) fingerprint');

      // The session is live: the engine serves a non-empty deck + live telemetry.
      await _expectSnapshot(conn);
      await _expectStateDelta(conn);
      await conn.close();
    } finally {
      await eng.dispose();
    }
  }, timeout: const Timeout(Duration(seconds: 90)), skip: skip);

  // --- J1: author-live — place a gauge, reflects on the device <200ms -------------
  test('J1 author-live: AddWidget(gauge) op reflects on the device in <200ms',
      () async {
    final eng = await _Engine.start(enginePath!, port: 8811);
    try {
      final payload = await eng.pairingPayload();
      final conn = await eng.pair(payload).timeout(const Duration(seconds: 15));

      // Build the device renderer from the engine's authoritative snapshot — exactly
      // as the live deck does (LayoutPage.fromJson → LayoutInterpreter).
      final snap = await conn.router.layout
          .firstWhere((e) => e.type == 'layout.snapshot')
          .timeout(const Duration(seconds: 10));
      final pageJson =
          jsonDecode(utf8.decode(snap.payload)) as Map<String, dynamic>;
      final baseVersion = (pageJson['version'] as num?)?.toInt() ?? 1;
      final interp = LayoutInterpreter(registry: RendererRegistry.withBuiltins())
        ..load(LayoutPage.fromJson(pageJson));
      final applier = LayoutApplier(interp, baseVersion: baseVersion);

      // The author places a new circular gauge bound to live CPU. This is the same op
      // JSON the Designer emits and the engine op-log versions (PROJ-211/212).
      final builder =
          OpBuilder(pageId: pageJson['id'] as String, docVersion: baseVersion + 1);
      final addGauge = builder.addWidget(const WidgetNode(
        id: 'w-authored-gauge',
        type: 'gauge.circular',
        placement: Placement(col: 0, row: 0, colSpan: 2, rowSpan: 2),
        appearance:
            Appearance(style: {'label': 'CPU'}, stateBinding: 'system.cpu.percent'),
      ));

      expect(interp.widgetIds.contains('w-authored-gauge'), isFalse);

      // Apply + reflect: assert the placement is visible on the device tree well
      // within the 200ms author-live budget (in-process apply path).
      final sw = Stopwatch()..start();
      applier.apply(_layoutOpEnvelope(addGauge));
      sw.stop();

      expect(applier.lastVersion, baseVersion + 1);
      expect(interp.widgetIds.contains('w-authored-gauge'), isTrue,
          reason: 'authored gauge must reflect on the device tree');
      final node = interp.nodeListenable('w-authored-gauge').value;
      expect(node.type, 'gauge.circular');
      expect(node.appearance.stateBinding, 'system.cpu.percent');
      expect(sw.elapsedMilliseconds, lessThan(200),
          reason:
              'author-live apply→reflect must be <200ms (was ${sw.elapsedMilliseconds}ms)');

      interp.dispose();
      await conn.close();
    } finally {
      await eng.dispose();
    }
  }, timeout: const Timeout(Duration(seconds: 90)), skip: skip);

  // --- J2: gaming-start — launch action (dry-run) + telemetry stays live ----------
  test('J2 gaming-start: launcher action runs (dry-run) and telemetry stays live',
      () async {
    final eng = await _Engine.start(enginePath!, port: 8812);
    try {
      final payload = await eng.pairingPayload();
      final conn = await eng.pair(payload).timeout(const Duration(seconds: 15));
      await _expectSnapshot(conn);

      // Tap the launcher: invoke launch.url (the default deck's GitHub button). The
      // engine runs launch actions in DRY-RUN by default (no --power-live), so this
      // resolves through the permission gate + plugin host without spawning anything.
      await conn.router.send(
          Channel.control,
          'interaction',
          utf8.encode(jsonEncode({
            'actionId': 'launch.url',
            'params': {'url': 'https://example.com'}
          })));

      // The action is authorized + executed engine-side (audited interaction.executed).
      await eng
          .waitForAudit('interaction.executed', contains: 'launch.url')
          .timeout(const Duration(seconds: 10));

      // And telemetry keeps flowing — a gaming HUD stays live after the launch.
      await _expectStateDelta(conn);
      await _expectStateDelta(conn); // a second delta confirms a continuing stream

      await conn.close();
    } finally {
      await eng.dispose();
    }
  }, timeout: const Timeout(Duration(seconds: 90)), skip: skip);

  // --- J6: permissioned 2nd device — restricted power action DENIED + AUDITED -----
  test(
      'J6 permissioned 2nd device: restricted power action is DENIED + AUDITED (P1-AC-07)',
      () async {
    final eng = await _Engine.start(enginePath!, port: 8813);
    try {
      final payload = await eng.pairingPayload();

      // Device #1 pairs normally (full default grant) — the "primary" device.
      final id1 = await DeviceIdentity.generate();
      final cm1 = ConnectionManager(identity: id1);
      final c1 = await cm1
          .connect(
              host: '127.0.0.1',
              port: eng.port,
              token: payload.token,
              expectedFingerprint: payload.fingerprint)
          .timeout(const Duration(seconds: 15));
      await _expectSnapshot(c1);

      // Device #2 pairs with a fresh token (each pairing token is single-use).
      final token2 = await eng.newPairingToken();
      final id2 = await DeviceIdentity.generate();
      final cm2 = ConnectionManager(identity: id2);
      var c2 = await cm2
          .connect(
              host: '127.0.0.1',
              port: eng.port,
              token: token2,
              expectedFingerprint: payload.fingerprint)
          .timeout(const Duration(seconds: 15));
      await _expectSnapshot(c2);

      // The operator restricts device #2 (power denied) via the privileged console.
      // That tightens its stored grant and drops its live session.
      await eng.restrict(id2.uuid);
      await c2.router.state.drain<void>().timeout(const Duration(seconds: 5));
      await c2.close();

      // Device #2 reconnects TOKENLESS — the engine now serves it the restricted grant
      // (power not permitted) it stored, while device #1 is unaffected.
      c2 = await cm2
          .connect(
              host: '127.0.0.1',
              port: eng.port,
              token: '',
              expectedFingerprint: payload.fingerprint)
          .timeout(const Duration(seconds: 15));
      await _expectSnapshot(c2);

      // Device #2 attempts a destructive power action that its layout still contains.
      // The engine enforces permissions on EVERY interaction — never trusting the
      // client/layout — so this is DENIED and AUDITED (P1-AC-07), without closing the
      // session.
      await c2.router.send(Channel.control, 'interaction',
          utf8.encode(jsonEncode({'actionId': 'system.restart'})));
      await eng
          .waitForAudit('interaction.denied', contains: 'system.restart')
          .timeout(const Duration(seconds: 10));

      // The denial is permission-driven, not a dropped session: device #2 is still
      // live and can do a PERMITTED action (volume) which IS executed.
      await c2.router.send(Channel.control, 'interaction',
          utf8.encode(jsonEncode({'actionId': 'volume.mute'})));
      await eng
          .waitForAudit('interaction.executed', contains: 'volume.mute')
          .timeout(const Duration(seconds: 10));

      // Device #1 (unrestricted) can still issue a power action — the restriction is
      // per-device, proving it is not a global lockout.
      await c1.router.send(Channel.control, 'interaction',
          utf8.encode(jsonEncode({'actionId': 'system.lock'})));
      await eng
          .waitForAudit('interaction.executed', contains: 'system.lock')
          .timeout(const Duration(seconds: 10));

      await c1.close();
      await c2.close();
    } finally {
      await eng.dispose();
    }
  }, timeout: const Timeout(Duration(seconds: 120)), skip: skip);

  // --- robustness: pair → reconnect tokenless → revoke ----------------------------
  test('robustness: pair → snapshot/telemetry → reconnect tokenless → revoke',
      () async {
    final eng = await _Engine.start(enginePath!, port: 8814);
    try {
      final payload = await eng.pairingPayload();
      final identity = eng.identity;

      // 1. Pair (with token) and verify the engine serves a deck + live telemetry.
      var conn = await eng.cm
          .connect(
              host: '127.0.0.1',
              port: eng.port,
              token: payload.token,
              expectedFingerprint: payload.fingerprint)
          .timeout(const Duration(seconds: 15));
      await _expectSnapshot(conn);
      await _expectStateDelta(conn);
      await conn.router.send(Channel.control, 'interaction',
          utf8.encode(jsonEncode({'actionId': 'system.lock'})));

      // 2. Drop, then reconnect WITHOUT a token (the engine knows this device).
      await conn.close();
      conn = await eng.cm
          .connect(
              host: '127.0.0.1',
              port: eng.port,
              token: '', // tokenless reconnect
              expectedFingerprint: payload.fingerprint)
          .timeout(const Duration(seconds: 15));
      await _expectSnapshot(conn);

      // 3. Revoke via the engine console → the live session drops.
      await eng.revoke(identity.uuid);
      await conn.router.state
          .drain<void>()
          .timeout(const Duration(seconds: 5)); // ends when the session closes
      await conn.close();

      // 4. A revoked device can no longer get back in (even tokenless).
      var rejected = false;
      try {
        final c = await eng.cm
            .connect(
                host: '127.0.0.1',
                port: eng.port,
                token: '',
                expectedFingerprint: payload.fingerprint)
            .timeout(const Duration(seconds: 10));
        await c.close();
      } catch (_) {
        rejected = true;
      }
      expect(rejected, isTrue, reason: 'a revoked device must be refused');
    } finally {
      await eng.dispose();
    }
  }, timeout: const Timeout(Duration(seconds: 90)), skip: skip);
}

/// A spawned real engine + its console + a device-1 ConnectionManager. Each test gets
/// a fresh engine on its own port + temp data dir; the engine stdout is drained into a
/// line buffer so tests can read pairing payloads + assert on audit lines.
class _Engine {
  _Engine._(this.proc, this.port, this.identity, this.cm, this._lines, this._outSub,
      this._dataDir);

  final Process proc;
  final int port;

  /// Device #1 identity + its connection manager (the common single-device path).
  final DeviceIdentity identity;
  final ConnectionManager cm;

  final List<String> _lines; // every stdout line the engine has emitted
  final StreamController<String> _newLines = StreamController<String>.broadcast();
  final StreamSubscription<String> _outSub;
  final Directory _dataDir;

  static Future<_Engine> start(String enginePath, {required int port}) async {
    final dataDir = Directory.systemTemp.createTempSync('cyberdeck-interop');
    final pluginsDir =
        '${File(enginePath).parent.path}${Platform.pathSeparator}plugins';
    final proc = await Process.start(enginePath, [
      '--console',
      '--port', '$port',
      '--data', dataDir.path,
      '--plugins', pluginsDir,
    ]);

    final id = await DeviceIdentity.generate();
    return _Engine._lateBind(proc, port, id, dataDir);
  }

  // Two-step bind so the stdout subscription closure can reference the instance's
  // broadcast sink (tests await both already-seen and future lines).
  static _Engine _lateBind(
      Process proc, int port, DeviceIdentity id, Directory dataDir) {
    final lines = <String>[];
    late final _Engine eng;
    final sub = proc.stdout
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen((line) {
      lines.add(line);
      if (!eng._newLines.isClosed) eng._newLines.add(line);
    });
    eng = _Engine._(
        proc, port, id, ConnectionManager(identity: id), lines, sub, dataDir);
    return eng;
  }

  /// Pairs device #1 with the payload's token + fingerprint.
  Future<EngineConnection> pair(PairingPayload payload) => cm.connect(
        host: '127.0.0.1',
        port: port,
        token: payload.token,
        expectedFingerprint: payload.fingerprint,
      );

  /// The pairing payload printed at boot (the QR/desktop-paste content).
  Future<PairingPayload> pairingPayload() async => PairingPayload.parse(
      (await _firstLineWith('payload: ').timeout(const Duration(seconds: 20)))
          .substring('payload: '.length));

  /// Mints a fresh single-use pairing token by pressing Enter on the console (each
  /// printed code is single-use) and parsing the new payload.
  Future<String> newPairingToken() async {
    final marker = _lines.length;
    proc.stdin.writeln('');
    await proc.stdin.flush();
    final line = await _firstLineWith('payload: ', from: marker)
        .timeout(const Duration(seconds: 10));
    return PairingPayload.parse(line.substring('payload: '.length)).token;
  }

  /// Console: revoke a device (drops its live session, blocks re-entry).
  Future<void> revoke(String uuid) async {
    proc.stdin.writeln('revoke $uuid');
    await proc.stdin.flush();
  }

  /// Console: restrict a device's permissions (power denied) + drop its session.
  Future<void> restrict(String uuid) async {
    proc.stdin.writeln('restrict $uuid');
    await proc.stdin.flush();
  }

  /// Completes when the engine emits an audit log line for [event] whose text also
  /// [contains] the given substring (e.g. an actionId). Scans already-seen lines too.
  Future<void> waitForAudit(String event, {required String contains}) {
    bool matches(String l) => l.contains('audit $event') && l.contains(contains);
    for (final l in _lines) {
      if (matches(l)) return Future<void>.value();
    }
    return _newLines.stream.firstWhere(matches).then((_) {});
  }

  Future<String> _firstLineWith(String prefix, {int from = 0}) {
    for (var i = from; i < _lines.length; i++) {
      if (_lines[i].trim().startsWith(prefix)) {
        return Future<String>.value(_lines[i].trim());
      }
    }
    return _newLines.stream
        .firstWhere((l) => l.trim().startsWith(prefix))
        .then((l) => l.trim());
  }

  Future<void> dispose() async {
    await _outSub.cancel();
    await _newLines.close();
    proc.kill();
    try {
      _dataDir.deleteSync(recursive: true);
    } catch (_) {}
  }
}

Envelope _layoutOpEnvelope(Map<String, dynamic> op) => Envelope(
      ch: Channel.layout,
      type: 'layout.op',
      payload: Uint8List.fromList(utf8.encode(jsonEncode(op))),
    );

Future<void> _expectSnapshot(EngineConnection conn) async {
  final snap = await conn.router.layout
      .firstWhere((e) => e.type == 'layout.snapshot')
      .timeout(const Duration(seconds: 10));
  final page = jsonDecode(utf8.decode(snap.payload)) as Map<String, dynamic>;
  expect((page['widgets'] as List), isNotEmpty);
}

Future<void> _expectStateDelta(EngineConnection conn) async {
  final delta = await conn.router.state
      .firstWhere((e) => e.type == 'state.delta')
      .timeout(const Duration(seconds: 10));
  final d = jsonDecode(utf8.decode(delta.payload)) as Map<String, dynamic>;
  expect(d['id'], isNotNull);
}
