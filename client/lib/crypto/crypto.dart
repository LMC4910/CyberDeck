/// Client session crypto (PROJ-180), mirroring the engine's PROJ-122 scheme so the
/// device and engine derive identical keys and the wire format interoperates:
///
/// - X25519 ECDH (forward-secret ephemerals + Ed25519-derived static keys),
/// - HKDF-SHA256 with info `cyberdeck/session/v1 chacha20poly1305`,
///   IKM = DH(ephemeral) ‖ DH(static), salt = nonceInitiator ‖ nonceResponder,
/// - ChaCha20-Poly1305 records (12-byte big-endian counter nonce, record =
///   nonce ‖ ciphertext ‖ tag),
/// - Ed25519 signing + the Ed25519→X25519 conversions (libsodium-compatible).
///
/// Only vetted primitives are used (`package:cryptography`); the Ed25519→X25519
/// conversions are the standard SHA-512/clamp (seed) and birational map (public).
library;

import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

/// HKDF info string binding derived keys to this protocol use (matches the engine).
const String kSessionInfo = 'cyberdeck/session/v1 chacha20poly1305';

/// AEAD key length / nonce length / tag length.
const int kAeadKeySize = 32;
const int kNonceSize = 12;
const int kTagSize = 16;

final X25519 _x25519 = X25519();
final Ed25519 _ed25519 = Ed25519();
final Chacha20 _chacha = Chacha20.poly1305Aead();

/// The two directional AEAD keys for a session. Both peers derive the identical
/// pair; each uses the key matching its send/receive direction.
class SessionKeys {
  const SessionKeys({
    required this.initiatorToResponder,
    required this.responderToInitiator,
  });

  final List<int> initiatorToResponder;
  final List<int> responderToInitiator;

  /// Key this peer encrypts with, given its role.
  List<int> send({required bool isInitiator}) =>
      isInitiator ? initiatorToResponder : responderToInitiator;

  /// Key this peer decrypts with, given its role.
  List<int> recv({required bool isInitiator}) =>
      isInitiator ? responderToInitiator : initiatorToResponder;
}

/// HKDF-SHA256: derives [length] bytes from [ikm] with [salt]/[info].
Future<List<int>> hkdfSha256({
  required List<int> ikm,
  required List<int> salt,
  required List<int> info,
  required int length,
}) async {
  final hkdf = Hkdf(hmac: Hmac.sha256(), outputLength: length);
  final key = await hkdf.deriveKey(
    secretKey: SecretKey(ikm),
    nonce: salt,
    info: info,
  );
  return key.extractBytes();
}

/// Derives the forward-secret directional session keys from an ECDH agreement.
/// IKM = DH(ephemeral) ‖ DH(static); salt = nonceInitiator ‖ nonceResponder. Both
/// peers derive the identical pair regardless of role (symmetric ECDH, fixed salt
/// ordering).
Future<SessionKeys> deriveSessionKeys({
  required SimpleKeyPair staticSelfPriv,
  required SimplePublicKey staticPeerPub,
  required SimpleKeyPair ephemeralSelfPriv,
  required SimplePublicKey ephemeralPeerPub,
  required List<int> nonceInitiator,
  required List<int> nonceResponder,
}) async {
  final dhEph = await _x25519.sharedSecretKey(
    keyPair: ephemeralSelfPriv,
    remotePublicKey: ephemeralPeerPub,
  );
  final dhStatic = await _x25519.sharedSecretKey(
    keyPair: staticSelfPriv,
    remotePublicKey: staticPeerPub,
  );
  final ikm = <int>[...await dhEph.extractBytes(), ...await dhStatic.extractBytes()];
  final salt = <int>[...nonceInitiator, ...nonceResponder];
  final okm = await hkdfSha256(
    ikm: ikm,
    salt: salt,
    info: utf8.encode(kSessionInfo),
    length: kAeadKeySize * 2,
  );
  return SessionKeys(
    initiatorToResponder: okm.sublist(0, kAeadKeySize),
    responderToInitiator: okm.sublist(kAeadKeySize),
  );
}

/// A one-direction AEAD record cipher. The sender holds a monotonic counter that
/// guarantees nonce uniqueness for the key's lifetime; each record is prefixed with
/// its 12-byte nonce so records open independently (`nonce ‖ ciphertext ‖ tag`),
/// matching the engine's `crypto.Cipher`.
class RecordCipher {
  RecordCipher(List<int> key) : _key = SecretKey(key);

  final SecretKey _key;
  int _counter = 0;

  /// Encrypts [plaintext] with the next nonce and returns nonce ‖ ciphertext ‖ tag.
  Future<Uint8List> seal(List<int> plaintext, {List<int> aad = const []}) async {
    final nonce = Uint8List(kNonceSize);
    // Big-endian counter in the last 8 bytes (offset 4..11).
    ByteData.sublistView(nonce).setUint64(kNonceSize - 8, _counter, Endian.big);
    _counter++;
    final box = await _chacha.encrypt(
      plaintext,
      secretKey: _key,
      nonce: nonce,
      aad: aad,
    );
    return Uint8List.fromList([...nonce, ...box.cipherText, ...box.mac.bytes]);
  }

  /// Decrypts a nonce-prefixed record produced by [seal]. Throws on auth failure.
  Future<List<int>> open(List<int> record, {List<int> aad = const []}) async {
    if (record.length < kNonceSize + kTagSize) {
      throw ArgumentError('record shorter than nonce+tag');
    }
    final nonce = record.sublist(0, kNonceSize);
    final mac = Mac(record.sublist(record.length - kTagSize));
    final cipherText = record.sublist(kNonceSize, record.length - kTagSize);
    final box = SecretBox(cipherText, nonce: nonce, mac: mac);
    return _chacha.decrypt(box, secretKey: _key, aad: aad);
  }
}

/// Derives the long-term X25519 private key from an Ed25519 seed: the low 32 bytes
/// of SHA-512(seed), clamped (RFC 7748) — libsodium's sk_to_curve25519.
Future<SimpleKeyPair> x25519FromEd25519Seed(List<int> seed) async {
  final h = await Sha512().hash(seed);
  final scalar = Uint8List.fromList(h.bytes.sublist(0, 32));
  scalar[0] &= 248;
  scalar[31] &= 127;
  scalar[31] |= 64;
  return _x25519.newKeyPairFromSeed(scalar);
}

final BigInt _p = (BigInt.one << 255) - BigInt.from(19);

/// Converts an Ed25519 public key to the corresponding X25519 (Montgomery) public
/// key: u = (1 + y) / (1 - y) mod 2²⁵⁵-19, where y is the little-endian Edwards
/// y-coordinate with the sign bit cleared. Equals the public key of
/// [x25519FromEd25519Seed] for the same identity (libsodium's pk_to_curve25519).
SimplePublicKey x25519PublicFromEd25519(List<int> edPublicKey) {
  if (edPublicKey.length != 32) {
    throw ArgumentError('ed25519 public key must be 32 bytes');
  }
  final yBytes = Uint8List.fromList(edPublicKey);
  yBytes[31] &= 0x7f; // clear the sign bit
  final y = _leToBigInt(yBytes);

  final num = (BigInt.one + y) % _p;
  var den = (BigInt.one - y) % _p;
  if (den.isNegative) den += _p;
  final u = (num * den.modInverse(_p)) % _p;

  return SimplePublicKey(_bigIntToLe(u, 32), type: KeyPairType.x25519);
}

/// Generates a fresh X25519 keypair (per-session ephemeral).
Future<SimpleKeyPair> generateX25519() => _x25519.newKeyPair();

/// Generates a fresh Ed25519 keypair (device identity).
Future<SimpleKeyPair> generateEd25519() => _ed25519.newKeyPair();

/// Loads an Ed25519 keypair from its 32-byte seed.
Future<SimpleKeyPair> ed25519FromSeed(List<int> seed) =>
    _ed25519.newKeyPairFromSeed(seed);

/// Signs [message] with an Ed25519 keypair, returning the 64-byte signature.
Future<List<int>> ed25519Sign(List<int> message, SimpleKeyPair keyPair) async {
  final sig = await _ed25519.sign(message, keyPair: keyPair);
  return sig.bytes;
}

/// Verifies an Ed25519 [signature] over [message] against a 32-byte public key.
Future<bool> ed25519Verify(
  List<int> message,
  List<int> signature,
  List<int> publicKey,
) {
  return _ed25519.verify(
    message,
    signature: Signature(
      signature,
      publicKey: SimplePublicKey(publicKey, type: KeyPairType.ed25519),
    ),
  );
}

/// The engine's public-key fingerprint: lowercase hex of SHA-256(Ed25519 pubkey).
/// Mirrors `Identity.Fingerprint()` and is the anti-MITM check at pairing.
Future<String> fingerprintOf(List<int> edPublicKey) async {
  final h = await Sha256().hash(edPublicKey);
  return _hex(h.bytes);
}

/// Extracts the raw public-key bytes from a [SimpleKeyPair].
Future<List<int>> publicKeyBytes(SimpleKeyPair keyPair) async {
  final pk = await keyPair.extractPublicKey();
  return pk.bytes;
}

String _hex(List<int> bytes) {
  final sb = StringBuffer();
  for (final b in bytes) {
    sb.write(b.toRadixString(16).padLeft(2, '0'));
  }
  return sb.toString();
}

BigInt _leToBigInt(List<int> bytes) {
  var result = BigInt.zero;
  for (var i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8) | BigInt.from(bytes[i] & 0xff);
  }
  return result;
}

Uint8List _bigIntToLe(BigInt value, int length) {
  final out = Uint8List(length);
  var v = value;
  final mask = BigInt.from(0xff);
  for (var i = 0; i < length; i++) {
    out[i] = (v & mask).toInt();
    v = v >> 8;
  }
  return out;
}
