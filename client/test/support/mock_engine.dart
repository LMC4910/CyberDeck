/// A faithful in-Dart mock of the engine's pairing responder + session, for testing
/// the client against a counterpart that speaks the exact same crypto + wire format
/// (PROJ-180). It plays the engine role: authorize the token, prove key possession,
/// derive the responder-side session keys.
library;

import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:cyberdeck_client/crypto/crypto.dart';
import 'package:cyberdeck_client/net/encrypted_session.dart';
import 'package:cyberdeck_client/net/framing.dart';

class MockEngine {
  MockEngine._(this.uuid, this._seed, this.edPublic, this._edKeyPair);

  final String uuid;
  final List<int> _seed;
  final List<int> edPublic;
  final SimpleKeyPair _edKeyPair;

  static Future<MockEngine> create({String uuid = 'engine-uuid-1'}) async {
    final kp = await generateEd25519();
    final seed = (await kp.extract()).bytes;
    final pub = await publicKeyBytes(kp);
    return MockEngine._(uuid, seed, pub, kp);
  }

  Future<String> fingerprint() => fingerprintOf(edPublic);

  /// Serves one handshake on the responder end of [frames]. On success returns the
  /// responder [EncryptedSession]; on a bad token / bad device signature it sends an
  /// error frame and returns null. [corruptSigE] forces an invalid engine signature
  /// (to exercise the client's badEngineSignature path).
  Future<EncryptedSession?> serve(
    FrameChannel frames, {
    required String expectedToken,
    bool corruptSigE = false,
  }) async {
    final hello = await _read(frames);
    final devicePub = base64.decode(hello['devicePublicKey'] as String);
    final deviceUuid = hello['deviceUuid'] as String? ?? '';

    if (hello['token'] != expectedToken) {
      _write(frames, {'type': 'error', 'error': 'bad or expired token'});
      await frames.close();
      return null;
    }

    final nonceE = _randomBytes(32);
    final engEph = await generateX25519();
    _write(frames, {
      'type': 'serverHello',
      'engineUuid': uuid,
      'enginePublicKey': base64.encode(edPublic),
      'nonceE': base64.encode(nonceE),
      'engineEphemeralPublic': base64.encode(await publicKeyBytes(engEph)),
    });

    final kc = await _read(frames);
    final nonceD = base64.decode(kc['nonceD'] as String);
    final devEphPub = base64.decode(kc['deviceEphemeralPublic'] as String);
    final sigD = base64.decode(kc['sigD'] as String);

    final okD = await ed25519Verify(
        Uint8List.fromList([...nonceE, ...nonceD]), sigD, devicePub);
    if (!okD) {
      _write(frames, {'type': 'error', 'error': 'bad device signature'});
      await frames.close();
      return null;
    }

    var sigE = await ed25519Sign(
        Uint8List.fromList([...nonceD, ...nonceE]), _edKeyPair);
    if (corruptSigE) {
      sigE = List<int>.from(sigE)..[0] ^= 0xff;
    }
    _write(frames, {
      'type': 'pairResult',
      'sigE': base64.encode(sigE),
      'assignedClass': '',
      'defaultPermsJson': '{"allowPowerActions":false}',
    });

    final keys = await deriveSessionKeys(
      staticSelfPriv: await x25519FromEd25519Seed(_seed),
      staticPeerPub: x25519PublicFromEd25519(devicePub),
      ephemeralSelfPriv: engEph,
      ephemeralPeerPub: SimplePublicKey(devEphPub, type: KeyPairType.x25519),
      nonceInitiator: nonceD, // device initiated
      nonceResponder: nonceE,
    );
    return EncryptedSession.create(
      frames: frames,
      keys: keys,
      isInitiator: false,
      deviceUuid: deviceUuid,
    );
  }

  void _write(FrameChannel frames, Map<String, dynamic> m) =>
      frames.write(utf8.encode(jsonEncode(m)));

  Future<Map<String, dynamic>> _read(FrameChannel frames) async {
    final frame = await frames.read();
    if (frame == null) throw StateError('mock engine: connection closed');
    return jsonDecode(utf8.decode(frame)) as Map<String, dynamic>;
  }

  Uint8List _randomBytes(int n) {
    final r = Random.secure();
    final b = Uint8List(n);
    for (var i = 0; i < n; i++) {
      b[i] = r.nextInt(256);
    }
    return b;
  }
}
