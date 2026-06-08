/// Client pairing (PROJ-180 / 2E §3), the device half of the engine's PROJ-123
/// handshake. The device is the initiator:
///
///   ClientHello → ServerHello → KeyConfirm → PairResult
///
/// The device proves possession of its Ed25519 key (sig over nonceE‖nonceD),
/// **verifies the engine's public-key fingerprint** (anti-MITM) before trusting it,
/// verifies the engine's own signature (nonceD‖nonceE), then derives forward-secret
/// session keys and opens an [EncryptedSession].
///
/// The engine has no on-wire handshake encoding yet (its `pairing.go` is an
/// in-memory state machine), so this file DEFINES the handshake wire format —
/// length-prefixed JSON frames with a `type` tag, byte fields base64 — to be matched
/// by the future engine accept/handshake-over-wire integration.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

import '../crypto/crypto.dart' as cdcrypto;
import 'encrypted_session.dart';
import 'framing.dart';

/// Pairing protocol version (matches the engine's `pairingProtoVersion`).
const int kPairingProtoVersion = 1;

/// Why a pairing attempt failed.
enum PairingFailure {
  /// The engine's fingerprint did not match the expected one (possible MITM).
  fingerprintMismatch,

  /// The engine rejected authorization (bad/expired token or denied PIN).
  unauthorized,

  /// The engine's signature did not verify (it doesn't hold the claimed key).
  badEngineSignature,

  /// A protocol/transport error (closed connection, malformed message).
  protocol,
}

/// A pairing error with a categorised [failure] and a human-readable [message].
class PairingException implements Exception {
  PairingException(this.failure, this.message);
  final PairingFailure failure;
  final String message;
  @override
  String toString() => 'PairingException(${failure.name}: $message)';
}

/// The QR / manual pairing payload the engine presents (2E §3.1): candidate
/// addresses, port, a short-lived single-use token, and the engine fingerprint.
class PairingPayload {
  const PairingPayload({
    required this.addresses,
    required this.port,
    required this.token,
    required this.fingerprint,
  });

  final List<String> addresses;
  final int port;
  final String token;
  final String fingerprint;

  /// Parses a scanned/typed JSON payload, validating required fields.
  static PairingPayload parse(String source) {
    final Map<String, dynamic> m;
    try {
      m = jsonDecode(source) as Map<String, dynamic>;
    } catch (_) {
      throw const FormatException('pairing payload is not valid JSON');
    }
    final addrs = (m['addresses'] as List?)?.cast<String>() ?? const [];
    final port = (m['port'] as num?)?.toInt() ?? 0;
    final token = m['token'] as String? ?? '';
    final fp = m['fp'] as String? ?? m['fingerprint'] as String? ?? '';
    if (addrs.isEmpty || port <= 0 || token.isEmpty || fp.isEmpty) {
      throw const FormatException('pairing payload missing required fields');
    }
    return PairingPayload(
        addresses: addrs, port: port, token: token, fingerprint: fp);
  }

  String encode() => jsonEncode({
        'addresses': addresses,
        'port': port,
        'token': token,
        'fp': fingerprint,
      });
}

/// The device's long-lived identity (Ed25519 keypair + UUID).
class DeviceIdentity {
  DeviceIdentity({
    required this.uuid,
    required this.seed,
    required this.publicKey,
    required this.keyPair,
  });

  final String uuid;
  final List<int> seed; // 32-byte Ed25519 seed
  final List<int> publicKey; // 32-byte Ed25519 public key
  final SimpleKeyPair keyPair;

  static Future<DeviceIdentity> _fromSeed(String uuid, List<int> seed) async {
    final kp = await cdcrypto.ed25519FromSeed(seed);
    return DeviceIdentity(
      uuid: uuid,
      seed: seed,
      publicKey: await cdcrypto.publicKeyBytes(kp),
      keyPair: kp,
    );
  }

  /// Generates a fresh device identity.
  static Future<DeviceIdentity> generate() async {
    final kp = await cdcrypto.generateEd25519();
    final seed = (await kp.extract()).bytes;
    return DeviceIdentity(
      uuid: _randomUuidV4(),
      seed: seed,
      publicKey: await cdcrypto.publicKeyBytes(kp),
      keyPair: kp,
    );
  }

  /// Loads the persisted identity, creating + persisting it on first run. The seed
  /// is stored only in the OS-backed [KeyStore] (never plaintext on disk).
  static Future<DeviceIdentity> loadOrCreate(KeyStore store) async {
    final uuid = await store.read(_kUuid);
    final seedB64 = await store.read(_kSeed);
    if (uuid != null && seedB64 != null) {
      return _fromSeed(uuid, base64.decode(seedB64));
    }
    final id = await generate();
    await store.write(_kUuid, id.uuid);
    await store.write(_kSeed, base64.encode(id.seed));
    return id;
  }

  static const String _kUuid = 'device.uuid';
  static const String _kSeed = 'device.seed';
}

/// Persists the small device-identity secrets (uuid + Ed25519 seed). The concrete
/// OS-backed implementation is injected by the app at runtime — on mobile an
/// Android Keystore / iOS Keychain-backed store, so the seed is never written in
/// plaintext. Keeping it behind this seam keeps the net layer free of a heavy
/// platform plugin (and the desktop build free of the ATL dependency that the
/// Windows secure-storage plugin requires).
abstract class KeyStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
}

/// In-memory keystore (tests + a non-persistent default).
class InMemoryKeyStore implements KeyStore {
  final Map<String, String> _m = {};
  @override
  Future<String?> read(String key) async => _m[key];
  @override
  Future<void> write(String key, String value) async => _m[key] = value;
}

/// The result of a successful pairing.
class PairingOutcome {
  PairingOutcome({
    required this.session,
    required this.engineUuid,
    required this.engineFingerprint,
    required this.assignedClass,
    required this.defaultPermsJson,
  });

  final EncryptedSession session;
  final String engineUuid;
  final String engineFingerprint;
  final String assignedClass;
  final String defaultPermsJson;
}

/// Runs the device-side pairing handshake over a [FrameChannel].
class PairingClient {
  PairingClient({Random? random}) : _random = random ?? Random.secure();

  final Random _random;

  /// Pairs with the engine: sends ClientHello, verifies the engine fingerprint and
  /// signature, and on success returns an open [EncryptedSession]. Throws
  /// [PairingException] on mismatch / unauthorized / bad signature / protocol error.
  Future<PairingOutcome> pair({
    required FrameChannel frames,
    required DeviceIdentity identity,
    required String token,
    required String expectedFingerprint,
  }) async {
    // 1. ClientHello.
    _writeMsg(frames, {
      'type': 'clientHello',
      'deviceUuid': identity.uuid,
      'devicePublicKey': base64.encode(identity.publicKey),
      'protoVersion': kPairingProtoVersion,
      'token': token,
    });

    // 2. ServerHello (or an error from authorization/state).
    final hello = await _readMsg(frames);
    _checkError(hello);
    _expect(hello, 'serverHello');
    final enginePub = base64.decode(hello['enginePublicKey'] as String);
    final nonceE = base64.decode(hello['nonceE'] as String);
    final engineEph = base64.decode(hello['engineEphemeralPublic'] as String);
    final engineUuid = hello['engineUuid'] as String? ?? '';

    // 3. Verify the engine fingerprint BEFORE trusting anything (anti-MITM).
    final actualFp = await cdcrypto.fingerprintOf(enginePub);
    if (actualFp != expectedFingerprint) {
      unawaited(frames.close());
      throw PairingException(
        PairingFailure.fingerprintMismatch,
        'engine fingerprint $actualFp does not match expected $expectedFingerprint',
      );
    }

    // 4. KeyConfirm: prove key possession (sig over nonceE‖nonceD) + ephemeral.
    final nonceD = _randomBytes(32);
    final devEph = await cdcrypto.generateX25519();
    final sigD = await cdcrypto.ed25519Sign(
        Uint8List.fromList([...nonceE, ...nonceD]), identity.keyPair);
    _writeMsg(frames, {
      'type': 'keyConfirm',
      'nonceD': base64.encode(nonceD),
      'deviceEphemeralPublic':
          base64.encode(await cdcrypto.publicKeyBytes(devEph)),
      'sigD': base64.encode(sigD),
    });

    // 5. PairResult (or an error).
    final result = await _readMsg(frames);
    _checkError(result);
    _expect(result, 'pairResult');
    final sigE = base64.decode(result['sigE'] as String);

    // 6. Verify the engine's signature (nonceD‖nonceE).
    final okE = await cdcrypto.ed25519Verify(
        Uint8List.fromList([...nonceD, ...nonceE]), sigE, enginePub);
    if (!okE) {
      unawaited(frames.close());
      throw PairingException(PairingFailure.badEngineSignature,
          'engine signature did not verify');
    }

    // 7. Derive forward-secret session keys (device = initiator).
    final keys = await cdcrypto.deriveSessionKeys(
      staticSelfPriv: await cdcrypto.x25519FromEd25519Seed(identity.seed),
      staticPeerPub: cdcrypto.x25519PublicFromEd25519(enginePub),
      ephemeralSelfPriv: devEph,
      ephemeralPeerPub:
          SimplePublicKey(engineEph, type: KeyPairType.x25519),
      nonceInitiator: nonceD, // device initiated
      nonceResponder: nonceE,
    );

    return PairingOutcome(
      session: EncryptedSession.create(
        frames: frames,
        keys: keys,
        isInitiator: true,
        deviceUuid: identity.uuid,
      ),
      engineUuid: engineUuid,
      engineFingerprint: actualFp,
      assignedClass: result['assignedClass'] as String? ?? '',
      defaultPermsJson: result['defaultPermsJson'] as String? ?? '',
    );
  }

  void _writeMsg(FrameChannel frames, Map<String, dynamic> m) =>
      frames.write(utf8.encode(jsonEncode(m)));

  Future<Map<String, dynamic>> _readMsg(FrameChannel frames) async {
    final frame = await frames.read();
    if (frame == null) {
      throw PairingException(
          PairingFailure.protocol, 'connection closed during handshake');
    }
    try {
      return jsonDecode(utf8.decode(frame)) as Map<String, dynamic>;
    } catch (_) {
      throw PairingException(
          PairingFailure.protocol, 'malformed handshake message');
    }
  }

  void _checkError(Map<String, dynamic> m) {
    if (m['type'] == 'error') {
      throw PairingException(
        PairingFailure.unauthorized,
        m['error'] as String? ?? 'engine rejected pairing',
      );
    }
  }

  void _expect(Map<String, dynamic> m, String type) {
    if (m['type'] != type) {
      throw PairingException(
          PairingFailure.protocol, 'expected $type, got ${m['type']}');
    }
  }

  Uint8List _randomBytes(int n) {
    final b = Uint8List(n);
    for (var i = 0; i < n; i++) {
      b[i] = _random.nextInt(256);
    }
    return b;
  }
}

String _randomUuidV4() {
  final r = Random.secure();
  final b = List<int>.generate(16, (_) => r.nextInt(256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  String h(int start, int end) {
    final sb = StringBuffer();
    for (var i = start; i < end; i++) {
      sb.write(b[i].toRadixString(16).padLeft(2, '0'));
    }
    return sb.toString();
  }

  return '${h(0, 4)}-${h(4, 6)}-${h(6, 8)}-${h(8, 10)}-${h(10, 16)}';
}
