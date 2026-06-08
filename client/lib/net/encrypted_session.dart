/// Client encrypted session (PROJ-180), mirroring the engine's
/// `transport.EncryptedSession`: post-handshake every frame's payload is
/// AEAD-encrypted with a per-direction counter cipher. A read loop pulls frames →
/// opens → decodes inbound envelopes (in order); sends are serialized so the
/// sender's nonce-counter order matches the wire order. The client is the
/// initiator. Teardown on auth failure (tamper) or close, with no leaked loop.
///
/// It reads/writes over a [FrameChannel] shared with the preceding plaintext
/// handshake, so it continues from exactly where the handshake left off.
library;

import 'dart:async';

import '../crypto/crypto.dart';
import 'envelope.dart';
import 'framing.dart';

/// An authenticated, encrypted, framed session over a [FrameChannel].
class EncryptedSession {
  EncryptedSession._(this._frames, this._send, this._recv, this.deviceUuid) {
    unawaited(_readLoop());
  }

  final FrameChannel _frames;
  final RecordCipher _send;
  final RecordCipher _recv;

  /// The paired device's UUID (empty on the engine side).
  final String deviceUuid;

  final StreamController<Envelope> _inbound = StreamController<Envelope>();
  final Completer<void> _done = Completer<void>();
  Future<void> _writeChain = Future<void>.value();
  bool _closed = false;
  Object? _error;

  /// Builds a session over [frames] from the handshake-derived [keys].
  /// [isInitiator] selects the send/receive key direction (device = initiator).
  static EncryptedSession create({
    required FrameChannel frames,
    required SessionKeys keys,
    required bool isInitiator,
    String deviceUuid = '',
  }) {
    return EncryptedSession._(
      frames,
      RecordCipher(keys.send(isInitiator: isInitiator)),
      RecordCipher(keys.recv(isInitiator: isInitiator)),
      deviceUuid,
    );
  }

  /// Decrypted inbound envelopes; closed on teardown.
  Stream<Envelope> get received => _inbound.stream;

  /// Completes when the session has fully torn down.
  Future<void> get done => _done.future;

  /// The teardown cause (null for a clean close).
  Object? get error => _error;

  /// Queues an envelope for encrypted transmission. Sends are serialized so the
  /// AEAD counter order matches the wire order.
  Future<void> send(Envelope env) {
    if (_closed) return Future.error(StateError('session closed'));
    final chained = _writeChain.then((_) async {
      final record = await _send.seal(env.marshal());
      _frames.write(record);
    });
    _writeChain = chained.catchError((_) {}); // keep the chain alive on error
    return chained;
  }

  Future<void> _readLoop() async {
    try {
      while (true) {
        final record = await _frames.read();
        if (record == null) break; // clean close
        final plain = await _recv.open(record); // AEAD auth failure → throws
        if (!_inbound.isClosed) _inbound.add(Envelope.unmarshal(plain));
      }
      await _teardown(null);
    } catch (e) {
      await _teardown(e); // tamper / framing / decode error
    }
  }

  /// Tears the session down cleanly. Idempotent.
  Future<void> close() => _teardown(null);

  Future<void> _teardown(Object? cause) async {
    if (_closed) return;
    _closed = true;
    _error ??= cause;
    // Resource cleanup runs in the background: a single-subscription controller's
    // close() future can stall when its listener was already cancelled, which must
    // never block a caller awaiting session close. The read loop ends on the
    // cancelled subscription regardless.
    unawaited(_frames.close());
    if (!_inbound.isClosed) unawaited(_inbound.close());
    if (!_done.isCompleted) _done.complete();
  }
}
