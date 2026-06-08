import 'dart:async';

import 'package:cyberdeck_client/net/conn.dart';
import 'package:cyberdeck_client/net/connection_manager.dart';
import 'package:cyberdeck_client/net/framing.dart';
import 'package:cyberdeck_client/net/pairing.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/mock_engine.dart';

/// A dialer that wires the client end to a fresh [MockEngine] responder.
Dialer engineDialer(MockEngine mock, {required String token}) {
  return (host, port) async {
    final (a, b) = duplexPipe();
    unawaited(mock
        .serve(FrameChannel(b), expectedToken: token)
        .catchError((_) => null));
    return FrameChannel(a);
  };
}

void main() {
  late DeviceIdentity device;
  late MockEngine mock;
  setUp(() async {
    device = await DeviceIdentity.generate();
    mock = await MockEngine.create();
  });

  test('connect dials, pairs, and yields a live connection', () async {
    final cm = ConnectionManager(
      identity: device,
      dialer: engineDialer(mock, token: 'tok'),
    );
    final conn = await cm.connect(
      host: 'engine.local',
      port: 47600,
      token: 'tok',
      expectedFingerprint: await mock.fingerprint(),
    );
    expect(conn.engineUuid, mock.uuid);
    expect(conn.engineFingerprint, await mock.fingerprint());
    await conn.close();
  });

  test('connectWithRetry retries transient transport failures', () async {
    var calls = 0;
    final cm = ConnectionManager(
      identity: device,
      sleep: (_) async {}, // no real delay
      dialer: (host, port) async {
        calls++;
        if (calls < 3) {
          throw const SocketLikeError(); // transient
        }
        final (a, b) = duplexPipe();
        unawaited(mock
            .serve(FrameChannel(b), expectedToken: 'tok')
            .catchError((_) => null));
        return FrameChannel(a);
      },
    );
    final conn = await cm.connectWithRetry(
      host: 'engine.local',
      port: 47600,
      token: 'tok',
      expectedFingerprint: await mock.fingerprint(),
      maxAttempts: 5,
    );
    expect(calls, 3);
    await conn.close();
  });

  test('connectWithRetry does NOT retry a fingerprint mismatch', () async {
    var calls = 0;
    final cm = ConnectionManager(
      identity: device,
      sleep: (_) async {},
      dialer: (host, port) {
        calls++;
        return engineDialer(mock, token: 'tok')(host, port);
      },
    );
    await expectLater(
      cm.connectWithRetry(
        host: 'engine.local',
        port: 47600,
        token: 'tok',
        expectedFingerprint: 'deadbeef' * 8,
        maxAttempts: 5,
      ),
      throwsA(isA<PairingException>().having(
          (e) => e.failure, 'failure', PairingFailure.fingerprintMismatch)),
    );
    expect(calls, 1); // terminal — not retried
  });
}

class SocketLikeError implements Exception {
  const SocketLikeError();
}
