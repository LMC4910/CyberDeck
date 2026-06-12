import 'dart:async';

import 'package:cyberdeck_client/net/conn.dart';
import 'package:cyberdeck_client/net/connection_manager.dart';
import 'package:cyberdeck_client/net/framing.dart';
import 'package:cyberdeck_client/net/manual_pair.dart';
import 'package:cyberdeck_client/net/pairing.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/mock_engine.dart';

/// A dialer that wires the client end to a fresh [MockEngine] responder, treating
/// [pin] as the engine's expected pairing token (the PIN is carried as the token).
Dialer engineDialer(MockEngine mock, {required String pin}) {
  return (host, port) async {
    final (a, b) = duplexPipe();
    unawaited(mock
        .serve(FrameChannel(b), expectedToken: pin)
        .catchError((_) => null));
    return FrameChannel(a);
  };
}

void main() {
  group('ManualPairEntry.parse', () {
    test('bare host defaults to the engine port', () {
      final e = ManualPairEntry.parse(
          address: '192.168.1.50', pin: '1234', fingerprint: 'fp');
      expect(e.host, '192.168.1.50');
      expect(e.port, kDefaultEnginePort);
      expect(e.pin, '1234');
      expect(e.fingerprint, 'fp');
    });

    test('host:port is split', () {
      final e = ManualPairEntry.parse(
          address: '10.0.0.9:48000', pin: '1234', fingerprint: 'fp');
      expect(e.host, '10.0.0.9');
      expect(e.port, 48000);
    });

    test('surrounding whitespace is trimmed on every field', () {
      final e = ManualPairEntry.parse(
          address: '  10.0.0.9:48000  ',
          pin: '  9999 ',
          fingerprint: '  abc ');
      expect(e.host, '10.0.0.9');
      expect(e.port, 48000);
      expect(e.pin, '9999');
      expect(e.fingerprint, 'abc');
    });

    test('bracketed IPv6 with port', () {
      final e = ManualPairEntry.parse(
          address: '[fe80::1]:47600', pin: '1', fingerprint: 'fp');
      expect(e.host, 'fe80::1');
      expect(e.port, 47600);
    });

    test('bare IPv6 literal uses the default port', () {
      final e = ManualPairEntry.parse(
          address: 'fe80::1', pin: '1', fingerprint: 'fp');
      expect(e.host, 'fe80::1');
      expect(e.port, kDefaultEnginePort);
    });

    test('empty host is rejected', () {
      expect(
        () => ManualPairEntry.parse(address: '', pin: '1', fingerprint: 'fp'),
        throwsA(isA<ManualPairException>()
            .having((e) => e.error, 'error', ManualPairError.badHost)),
      );
    });

    test('non-numeric / out-of-range port is rejected', () {
      expect(
        () => ManualPairEntry.parse(
            address: 'host:nope', pin: '1', fingerprint: 'fp'),
        throwsA(isA<ManualPairException>()
            .having((e) => e.error, 'error', ManualPairError.badPort)),
      );
      expect(
        () => ManualPairEntry.parse(
            address: 'host:70000', pin: '1', fingerprint: 'fp'),
        throwsA(isA<ManualPairException>()
            .having((e) => e.error, 'error', ManualPairError.badPort)),
      );
    });

    test('empty PIN is rejected', () {
      expect(
        () => ManualPairEntry.parse(
            address: 'host', pin: '   ', fingerprint: 'fp'),
        throwsA(isA<ManualPairException>()
            .having((e) => e.error, 'error', ManualPairError.badPin)),
      );
    });

    test('empty fingerprint is rejected (anti-MITM value required)', () {
      expect(
        () => ManualPairEntry.parse(
            address: 'host', pin: '1', fingerprint: ''),
        throwsA(isA<ManualPairException>()
            .having((e) => e.error, 'error', ManualPairError.badFingerprint)),
      );
    });
  });

  group('ManualPairer', () {
    late DeviceIdentity device;
    late MockEngine mock;
    setUp(() async {
      device = await DeviceIdentity.generate();
      mock = await MockEngine.create();
    });

    test('manual addr+PIN entry pairs and yields a live connection', () async {
      final cm = ConnectionManager(
        identity: device,
        dialer: engineDialer(mock, pin: '4242'),
      );
      final entry = ManualPairEntry.parse(
        address: '192.168.1.50:47600',
        pin: '4242',
        fingerprint: await mock.fingerprint(),
      );
      final conn = await ManualPairer(cm).pair(entry);
      expect(conn.engineUuid, mock.uuid);
      expect(conn.engineFingerprint, await mock.fingerprint());
      await conn.close();
    });

    test('wrong PIN surfaces an unauthorized failure', () async {
      final cm = ConnectionManager(
        identity: device,
        sleep: (_) async {},
        dialer: engineDialer(mock, pin: 'correct-pin'),
      );
      final entry = ManualPairEntry.parse(
        address: '192.168.1.50',
        pin: 'WRONG',
        fingerprint: await mock.fingerprint(),
      );
      await expectLater(
        ManualPairer(cm).pair(entry),
        throwsA(isA<PairingException>().having(
            (e) => e.failure, 'failure', PairingFailure.unauthorized)),
      );
    });

    test('typed fingerprint mismatch is rejected and NOT retried', () async {
      var calls = 0;
      final cm = ConnectionManager(
        identity: device,
        sleep: (_) async {},
        dialer: (host, port) {
          calls++;
          return engineDialer(mock, pin: '4242')(host, port);
        },
      );
      final entry = ManualPairEntry.parse(
        address: '192.168.1.50',
        pin: '4242',
        fingerprint: 'deadbeef' * 8, // not the engine's fingerprint
      );
      await expectLater(
        ManualPairer(cm).pair(entry),
        throwsA(isA<PairingException>().having(
            (e) => e.failure, 'failure', PairingFailure.fingerprintMismatch)),
      );
      expect(calls, 1); // terminal — not retried
    });
  });
}
