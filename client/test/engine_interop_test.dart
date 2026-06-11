// Real end-to-end interop test against the actual Go engine. Beyond pairing +
// snapshot + telemetry + interaction, it proves the robustness path: drop →
// TOKENLESS auto-reconnect (the engine recognises the known device) → revoke (via
// the engine console) drops the live session and blocks re-entry.
//
// Needs the built engine; set CYBERDECK_ENGINE to its exe path (plugins/ resolved
// next to it). Without it the test skips, so `flutter test` stays green.
//
//   run/ layout:  run/cyberdeck.exe  +  run/plugins/{telemetry,power,volume,launchers}/*
//   flutter test test/engine_interop_test.dart   (with CYBERDECK_ENGINE set)
@TestOn('vm')
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:cyberdeck_client/net/connection_manager.dart';
import 'package:cyberdeck_client/net/envelope.dart';
import 'package:cyberdeck_client/net/pairing.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final enginePath = Platform.environment['CYBERDECK_ENGINE'];

  test('real engine: pair → snapshot/telemetry → reconnect tokenless → revoke',
      () async {
    final dataDir = Directory.systemTemp.createTempSync('cyberdeck-interop');
    final pluginsDir =
        '${File(enginePath!).parent.path}${Platform.pathSeparator}plugins';
    const port = 8788;

    final proc = await Process.start(enginePath, [
      '--console',
      '--port', '$port',
      '--data', dataDir.path,
      '--plugins', pluginsDir,
    ]);

    // Drain stdout continuously (so the engine never blocks on a full pipe) while
    // capturing the pairing payload.
    final payloadC = Completer<String>();
    final outSub = proc.stdout
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen((line) {
      final t = line.trim();
      if (!payloadC.isCompleted && t.startsWith('payload: ')) {
        payloadC.complete(t.substring('payload: '.length));
      }
    });

    final identity = await DeviceIdentity.generate();
    final cm = ConnectionManager(identity: identity);
    EngineConnection? conn;
    try {
      final payload =
          PairingPayload.parse(await payloadC.future.timeout(const Duration(seconds: 20)));

      // 1. Pair (with token) and verify the engine serves a deck + live telemetry.
      conn = await cm
          .connect(
              host: '127.0.0.1',
              port: port,
              token: payload.token,
              expectedFingerprint: payload.fingerprint)
          .timeout(const Duration(seconds: 15));
      await _expectSnapshot(conn);
      await _expectStateDelta(conn);
      await conn.router.send(Channel.control, 'interaction',
          utf8.encode(jsonEncode({'actionId': 'system.lock'})));

      // 2. Drop, then reconnect WITHOUT a token (the engine knows this device).
      await conn.close();
      conn = await cm
          .connect(
              host: '127.0.0.1',
              port: port,
              token: '', // tokenless reconnect
              expectedFingerprint: payload.fingerprint)
          .timeout(const Duration(seconds: 15));
      await _expectSnapshot(conn);

      // 3. Revoke via the engine console → the live session drops.
      proc.stdin.writeln('revoke ${identity.uuid}');
      await proc.stdin.flush();
      await conn.router.state
          .drain<void>()
          .timeout(const Duration(seconds: 5)); // ends when the session closes
      await conn.close();
      conn = null;

      // 4. A revoked device can no longer get back in (even tokenless).
      var rejected = false;
      try {
        final c = await cm
            .connect(
                host: '127.0.0.1',
                port: port,
                token: '',
                expectedFingerprint: payload.fingerprint)
            .timeout(const Duration(seconds: 10));
        await c.close();
      } catch (_) {
        rejected = true;
      }
      expect(rejected, isTrue, reason: 'a revoked device must be refused');
    } finally {
      await conn?.close();
      await outSub.cancel();
      proc.kill();
      try {
        dataDir.deleteSync(recursive: true);
      } catch (_) {}
    }
  },
      timeout: const Timeout(Duration(seconds: 90)),
      skip: enginePath == null
          ? 'set CYBERDECK_ENGINE to the built engine exe to run the live interop test'
          : false);
}

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
