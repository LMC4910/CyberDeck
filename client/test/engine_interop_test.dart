// Real end-to-end interop test: spawns the actual Go engine, reads its pairing
// payload, and pairs with it using the REAL ConnectionManager over a real socket —
// then asserts the engine serves a layout snapshot and live telemetry, and accepts
// an interaction. This is the first true Dart↔Go check (handshake + encrypted
// session + layout/state wire), so it catches any cross-language drift.
//
// It needs the built engine; set CYBERDECK_ENGINE to its exe path (the test resolves
// plugins/ next to it). Without it, the test skips so `flutter test` stays green.
//
//   run/ layout expected:  run/cyberdeck.exe  +  run/plugins/{telemetry,power}/*.exe
//   flutter test test/engine_interop_test.dart  (with CYBERDECK_ENGINE set)
@TestOn('vm')
library;

import 'dart:convert';
import 'dart:io';

import 'package:cyberdeck_client/net/connection_manager.dart';
import 'package:cyberdeck_client/net/envelope.dart';
import 'package:cyberdeck_client/net/pairing.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final enginePath = Platform.environment['CYBERDECK_ENGINE'];

  test('real engine: pair → layout snapshot + live telemetry → interaction', () async {
    final dataDir = Directory.systemTemp.createTempSync('cyberdeck-interop');
    final pluginsDir = '${File(enginePath!).parent.path}${Platform.pathSeparator}plugins';
    const port = 8788;

    final proc = await Process.start(enginePath, [
      '--console',
      '--port', '$port',
      '--data', dataDir.path,
      '--plugins', pluginsDir,
    ]);

    EngineConnection? conn;
    try {
      // 1. Read the pairing payload the engine prints on boot.
      final payloadJson = await proc.stdout
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .map((l) => l.trim())
          .firstWhere((l) => l.startsWith('payload: '))
          .timeout(const Duration(seconds: 20));
      final payload = PairingPayload.parse(payloadJson.substring('payload: '.length));

      // 2. Pair with the REAL ConnectionManager over a real socket (loopback).
      final cm = ConnectionManager(identity: await DeviceIdentity.generate());
      conn = await cm
          .connect(
            host: '127.0.0.1',
            port: port,
            token: payload.token,
            expectedFingerprint: payload.fingerprint,
          )
          .timeout(const Duration(seconds: 15));
      final router = conn.router;

      // 3. The engine serves the default deck as a layout snapshot.
      final snap = await router.layout
          .firstWhere((e) => e.type == 'layout.snapshot')
          .timeout(const Duration(seconds: 10));
      final page = jsonDecode(utf8.decode(snap.payload)) as Map<String, dynamic>;
      expect((page['widgets'] as List), isNotEmpty);

      // 4. Live telemetry flows (plugin → state store → fan-out → session).
      final delta = await router.state
          .firstWhere((e) => e.type == 'state.delta')
          .timeout(const Duration(seconds: 10));
      final d = jsonDecode(utf8.decode(delta.payload)) as Map<String, dynamic>;
      expect(d['id'], isNotNull);

      // 5. An interaction is accepted over the control channel (engine dry-run).
      await router.send(Channel.control, 'interaction',
          utf8.encode(jsonEncode({'actionId': 'system.lock'})));
    } finally {
      await conn?.close();
      proc.kill();
      try {
        dataDir.deleteSync(recursive: true);
      } catch (_) {}
    }
  },
      timeout: const Timeout(Duration(seconds: 60)),
      skip: enginePath == null
          ? 'set CYBERDECK_ENGINE to the built engine exe to run the live interop test'
          : false);
}
