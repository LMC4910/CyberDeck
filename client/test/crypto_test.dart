import 'package:cryptography/cryptography.dart';
import 'package:cyberdeck_client/crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';

List<int> _ramp(int start) => List<int>.generate(32, (i) => (start + i) & 0xff);

List<int> _hexDecode(String s) {
  final out = <int>[];
  for (var i = 0; i < s.length; i += 2) {
    out.add(int.parse(s.substring(i, i + 2), radix: 16));
  }
  return out;
}

String _hexEncode(List<int> bytes) =>
    bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();

void main() {
  // Cross-language KAT vectors emitted from the Go engine
  // (core/security/crypto) so the Dart client crypto is provably interoperable.
  final seedD = List<int>.generate(32, (i) => i + 1); // 0x01..0x20
  final seedE = List<int>.generate(32, (i) => 0x80 + i);
  final ephDb = _ramp(0x11);
  final ephEb = _ramp(0x21);
  final nonceD = _ramp(0x41);
  final nonceE = _ramp(0x61);

  const katEdPubE =
      'cd14b37f956e953194ff7fb73b3d81dcc561d61a7538094b7c3e1a643ee5f3aa';
  const katDevStaticPub =
      '4a3807d064d077181cc070989e76891d20dca5559548dc2c77c1a50273882b38';
  const katEngStaticPub =
      '3de70cb2b9bb0bda3873d13e8a7cf4ea870dabeb296caa1dfce0a5f411c8d234';
  const katDevEphPub =
      '4d27bcee3135c4944b28d27dd809b07be10c35160d20131caa7e85575498d07c';
  const katEngEphPub =
      '5869aff450549732cbaaed5e5df9b30a6da31cb0e5742bad5ad4a1a768f1a67b';
  const katI2r =
      '2a995deef6e48ed2cf1a4321ba7f5e155aa55b35bbcb3f8b462e2e82de8e1a6d';
  const katR2i =
      'dd09a77803a31351b40f1cc745082e45c825ad3515d5428601aa433bd8428fe5';
  const katRecord =
      '000000000000000000000000b77b8cabf4489971c9c7518e64c06aab9c25b77a8bea3b9e2fbb85867bbc71';

  test('X25519FromEd25519Seed matches the engine (device static pub)', () async {
    final kp = await x25519FromEd25519Seed(seedD);
    expect(_hexEncode(await publicKeyBytes(kp)), katDevStaticPub);
  });

  test('x25519PublicFromEd25519 matches the engine + the seed path', () async {
    // Conversion from the Ed25519 public key.
    final fromEd = x25519PublicFromEd25519(_hexDecode(katEdPubE));
    expect(_hexEncode(fromEd.bytes), katEngStaticPub);
    // Equivalent to deriving from the seed (the engine's guarantee).
    final fromSeed = await x25519FromEd25519Seed(seedE);
    expect(_hexEncode(await publicKeyBytes(fromSeed)), katEngStaticPub);
  });

  test('ephemeral pubs from fixed scalars match the engine', () async {
    final devEph = await X25519().newKeyPairFromSeed(ephDb);
    final engEph = await X25519().newKeyPairFromSeed(ephEb);
    expect(_hexEncode(await publicKeyBytes(devEph)), katDevEphPub);
    expect(_hexEncode(await publicKeyBytes(engEph)), katEngEphPub);
  });

  test('deriveSessionKeys matches the engine KAT (device = initiator)', () async {
    final devStatic = await x25519FromEd25519Seed(seedD);
    final devEph = await X25519().newKeyPairFromSeed(ephDb);
    final keys = await deriveSessionKeys(
      staticSelfPriv: devStatic,
      staticPeerPub: SimplePublicKey(_hexDecode(katEngStaticPub),
          type: KeyPairType.x25519),
      ephemeralSelfPriv: devEph,
      ephemeralPeerPub:
          SimplePublicKey(_hexDecode(katEngEphPub), type: KeyPairType.x25519),
      nonceInitiator: nonceD,
      nonceResponder: nonceE,
    );
    expect(_hexEncode(keys.initiatorToResponder), katI2r);
    expect(_hexEncode(keys.responderToInitiator), katR2i);
  });

  test('RecordCipher.seal matches the engine AEAD record (counter 0)', () async {
    final cipher = RecordCipher(_hexDecode(katI2r));
    final record = await cipher.seal('hello cyberdeck'.codeUnits);
    expect(_hexEncode(record), katRecord);
  });

  test('RecordCipher round-trips and rejects tamper', () async {
    final sender = RecordCipher(_hexDecode(katI2r));
    final receiver = RecordCipher(_hexDecode(katI2r));
    final record = await sender.seal('payload'.codeUnits);
    expect(await receiver.open(record), 'payload'.codeUnits);

    final tampered = List<int>.from(record);
    tampered[tampered.length - 1] ^= 0xff; // flip a tag byte
    expect(() => RecordCipher(_hexDecode(katI2r)).open(tampered),
        throwsA(isA<Object>()));
  });

  test('session keys are symmetric across roles', () async {
    // Device (initiator) and engine (responder) independently derive the same pair.
    final devStatic = await x25519FromEd25519Seed(seedD);
    final engStatic = await x25519FromEd25519Seed(seedE);
    final devEph = await X25519().newKeyPairFromSeed(ephDb);
    final engEph = await X25519().newKeyPairFromSeed(ephEb);

    final dev = await deriveSessionKeys(
      staticSelfPriv: devStatic,
      staticPeerPub: SimplePublicKey(await publicKeyBytes(engStatic),
          type: KeyPairType.x25519),
      ephemeralSelfPriv: devEph,
      ephemeralPeerPub: SimplePublicKey(await publicKeyBytes(engEph),
          type: KeyPairType.x25519),
      nonceInitiator: nonceD,
      nonceResponder: nonceE,
    );
    final eng = await deriveSessionKeys(
      staticSelfPriv: engStatic,
      staticPeerPub: SimplePublicKey(await publicKeyBytes(devStatic),
          type: KeyPairType.x25519),
      ephemeralSelfPriv: engEph,
      ephemeralPeerPub: SimplePublicKey(await publicKeyBytes(devEph),
          type: KeyPairType.x25519),
      nonceInitiator: nonceD,
      nonceResponder: nonceE,
    );
    expect(eng.initiatorToResponder, dev.initiatorToResponder);
    expect(eng.responderToInitiator, dev.responderToInitiator);
  });

  test('fingerprint is 64-char lowercase hex and matches SHA-256', () async {
    final fp = await fingerprintOf(_hexDecode(katEdPubE));
    expect(fp.length, 64);
    expect(RegExp(r'^[0-9a-f]{64}$').hasMatch(fp), isTrue);
    final sha = await Sha256().hash(_hexDecode(katEdPubE));
    expect(fp, _hexEncode(sha.bytes));
  });
}
