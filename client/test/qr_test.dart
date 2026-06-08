import 'package:cyberdeck_client/net/pairing.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses a full QR pairing payload', () {
    final p = PairingPayload.parse(
        '{"addresses":["192.168.1.5","10.0.0.2"],"port":47600,'
        '"token":"abc","fp":"ff00"}');
    expect(p.addresses, ['192.168.1.5', '10.0.0.2']);
    expect(p.port, 47600);
    expect(p.token, 'abc');
    expect(p.fingerprint, 'ff00');
  });

  test('accepts "fingerprint" as an alias for "fp"', () {
    final p = PairingPayload.parse(
        '{"addresses":["h"],"port":1,"token":"t","fingerprint":"aa"}');
    expect(p.fingerprint, 'aa');
  });

  test('encode/parse round-trips', () {
    const original = PairingPayload(
      addresses: ['h1', 'h2'],
      port: 5,
      token: 'tok',
      fingerprint: 'fp',
    );
    final back = PairingPayload.parse(original.encode());
    expect(back.addresses, original.addresses);
    expect(back.port, original.port);
    expect(back.token, original.token);
    expect(back.fingerprint, original.fingerprint);
  });

  test('rejects malformed JSON', () {
    expect(() => PairingPayload.parse('{not json'),
        throwsA(isA<FormatException>()));
  });

  test('rejects payloads missing required fields', () {
    final bad = [
      '{"port":1,"token":"t","fp":"f"}', // no addresses
      '{"addresses":["h"],"token":"t","fp":"f"}', // no port
      '{"addresses":["h"],"port":1,"fp":"f"}', // no token
      '{"addresses":["h"],"port":1,"token":"t"}', // no fingerprint
    ];
    for (final s in bad) {
      expect(() => PairingPayload.parse(s), throwsA(isA<FormatException>()),
          reason: s);
    }
  });
}
