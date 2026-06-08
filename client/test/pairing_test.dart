import 'dart:async';
import 'dart:typed_data';

import 'package:cyberdeck_client/net/conn.dart';
import 'package:cyberdeck_client/net/envelope.dart';
import 'package:cyberdeck_client/net/framing.dart';
import 'package:cyberdeck_client/net/pairing.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/mock_engine.dart';

void main() {
  late DeviceIdentity device;
  setUp(() async {
    device = await DeviceIdentity.generate();
  });

  test('QR pair completes and establishes a working encrypted session', () async {
    final mock = await MockEngine.create();
    final (a, b) = duplexPipe();
    final clientFrames = FrameChannel(a);
    final engineFrames = FrameChannel(b);

    final engineFut = mock.serve(engineFrames, expectedToken: 'tok-123');
    final outcome = await PairingClient().pair(
      frames: clientFrames,
      identity: device,
      token: 'tok-123',
      expectedFingerprint: await mock.fingerprint(),
    );
    final engineSession = await engineFut;

    expect(engineSession, isNotNull);
    expect(outcome.engineUuid, mock.uuid);

    // Data plane works both directions, decrypted correctly.
    await outcome.session.send(Envelope(
      ch: Channel.state,
      type: 'ping',
      payload: Uint8List.fromList([1, 2, 3]),
    ));
    final atEngine = await engineSession!.received.first;
    expect(atEngine.type, 'ping');
    expect(atEngine.payload, [1, 2, 3]);

    await engineSession.send(Envelope(
      ch: Channel.layout,
      type: 'op',
      payload: Uint8List.fromList([9]),
    ));
    final atClient = await outcome.session.received.first;
    expect(atClient.ch, Channel.layout);
    expect(atClient.payload, [9]);

    await outcome.session.close();
    await engineSession.close();
  });

  test('wrong engine fingerprint is rejected (anti-MITM)', () async {
    final mock = await MockEngine.create();
    final (a, b) = duplexPipe();

    // Let the mock run; the client aborts after ServerHello on the fingerprint.
    unawaited(mock
        .serve(FrameChannel(b), expectedToken: 'tok')
        .catchError((_) => null));

    await expectLater(
      PairingClient().pair(
        frames: FrameChannel(a),
        identity: device,
        token: 'tok',
        expectedFingerprint: 'deadbeef' * 8, // not the engine's fingerprint
      ),
      throwsA(isA<PairingException>().having(
          (e) => e.failure, 'failure', PairingFailure.fingerprintMismatch)),
    );
  });

  test('bad/expired token is rejected with a clear failure', () async {
    final mock = await MockEngine.create();
    final (a, b) = duplexPipe();
    unawaited(mock.serve(FrameChannel(b), expectedToken: 'correct'));

    await expectLater(
      PairingClient().pair(
        frames: FrameChannel(a),
        identity: device,
        token: 'WRONG',
        expectedFingerprint: await mock.fingerprint(),
      ),
      throwsA(isA<PairingException>().having(
          (e) => e.failure, 'failure', PairingFailure.unauthorized)),
    );
  });

  test('a forged engine signature is rejected', () async {
    final mock = await MockEngine.create();
    final (a, b) = duplexPipe();
    unawaited(mock
        .serve(FrameChannel(b), expectedToken: 'tok', corruptSigE: true)
        .catchError((_) => null));

    await expectLater(
      PairingClient().pair(
        frames: FrameChannel(a),
        identity: device,
        token: 'tok',
        expectedFingerprint: await mock.fingerprint(),
      ),
      throwsA(isA<PairingException>().having(
          (e) => e.failure, 'failure', PairingFailure.badEngineSignature)),
    );
  });

  test('DeviceIdentity persists + reloads the same identity', () async {
    final store = InMemoryKeyStore();
    final id1 = await DeviceIdentity.loadOrCreate(store);
    final id2 = await DeviceIdentity.loadOrCreate(store);
    expect(id2.uuid, id1.uuid);
    expect(id2.publicKey, id1.publicKey);
    expect(id2.seed, id1.seed);
  });
}
