/// Length-prefixed framing (PROJ-180), mirroring the engine's `transport.Framer`:
/// each frame is `uint32` big-endian length ‖ payload, bounded on both directions.
/// Binary-safe (no escaping) so encrypted records ride inside frames directly.
library;

import 'dart:async';
import 'dart:typed_data';

import 'conn.dart';

/// Caps a single frame's payload (16 MiB), matching `DefaultMaxFrameSize`.
const int kMaxFrameSize = 16 << 20;

/// Thrown when a frame's declared length exceeds the maximum.
class FrameTooLargeException implements Exception {
  FrameTooLargeException(this.length, this.max);
  final int length;
  final int max;
  @override
  String toString() => 'FrameTooLargeException($length > $max)';
}

/// Encodes one length-prefixed frame.
Uint8List encodeFrame(List<int> payload, {int maxFrameSize = kMaxFrameSize}) {
  if (payload.length > maxFrameSize) {
    throw FrameTooLargeException(payload.length, maxFrameSize);
  }
  final out = Uint8List(4 + payload.length);
  ByteData.sublistView(out).setUint32(0, payload.length, Endian.big);
  out.setRange(4, out.length, payload);
  return out;
}

/// Transforms a raw byte stream into a stream of complete frame payloads,
/// buffering across arbitrary chunk boundaries and rejecting oversize frames
/// before allocating.
Stream<Uint8List> readFrames(
  Stream<List<int>> source, {
  int maxFrameSize = kMaxFrameSize,
}) async* {
  final buffer = <int>[];
  await for (final chunk in source) {
    buffer.addAll(chunk);
    while (true) {
      if (buffer.length < 4) break;
      final len = (buffer[0] << 24) |
          (buffer[1] << 16) |
          (buffer[2] << 8) |
          buffer[3];
      if (len > maxFrameSize) {
        throw FrameTooLargeException(len, maxFrameSize);
      }
      if (buffer.length < 4 + len) break;
      final frame = Uint8List.fromList(buffer.sublist(4, 4 + len));
      buffer.removeRange(0, 4 + len);
      yield frame;
    }
  }
}

/// A pull-based length-prefixed frame channel over a single [DuplexConn]. Both the
/// plaintext handshake and the encrypted session read from the SAME channel (the
/// socket's byte stream is single-subscription), so the handshake consumes its
/// frames and then hands the channel to the session, which keeps reading from where
/// the handshake left off.
///
/// It buffers raw bytes from one direct subscription and reassembles frames, so
/// [close] (which cancels that subscription) is always reliable — unlike cancelling
/// a `StreamIterator` over a generator while a read is pending on an open source.
class FrameChannel {
  FrameChannel(this._conn, {int maxFrameSize = kMaxFrameSize}) : _max = maxFrameSize {
    _sub = _conn.incoming.listen(_onData, onDone: _onDone, onError: _onError);
  }

  final DuplexConn _conn;
  final int _max;
  late final StreamSubscription<Uint8List> _sub;

  final List<int> _buffer = [];
  final List<Uint8List> _ready = [];
  final List<Completer<Uint8List?>> _waiters = [];
  bool _done = false;
  Object? _error;

  /// Reads the next frame payload, or null when the stream ends.
  Future<Uint8List?> read() {
    if (_ready.isNotEmpty) return Future.value(_ready.removeAt(0));
    if (_error != null) return Future.error(_error!);
    if (_done) return Future.value(null);
    final c = Completer<Uint8List?>();
    _waiters.add(c);
    return c.future;
  }

  /// Writes one length-prefixed frame.
  void write(List<int> payload) =>
      _conn.add(encodeFrame(payload, maxFrameSize: _max));

  /// Cancels the subscription and closes the underlying connection.
  Future<void> close() async {
    await _sub.cancel();
    await _conn.close();
    if (!_done) {
      _done = true;
      for (final w in _waiters) {
        w.complete(null);
      }
      _waiters.clear();
    }
  }

  void _onData(List<int> chunk) {
    _buffer.addAll(chunk);
    while (true) {
      if (_buffer.length < 4) break;
      final len = (_buffer[0] << 24) |
          (_buffer[1] << 16) |
          (_buffer[2] << 8) |
          _buffer[3];
      if (len > _max) {
        _onError(FrameTooLargeException(len, _max), StackTrace.current);
        return;
      }
      if (_buffer.length < 4 + len) break;
      final frame = Uint8List.fromList(_buffer.sublist(4, 4 + len));
      _buffer.removeRange(0, 4 + len);
      if (_waiters.isNotEmpty) {
        _waiters.removeAt(0).complete(frame);
      } else {
        _ready.add(frame);
      }
    }
  }

  void _onDone() {
    _done = true;
    for (final w in _waiters) {
      w.complete(null);
    }
    _waiters.clear();
  }

  void _onError(Object e, StackTrace st) {
    _error = e;
    _done = true;
    for (final w in _waiters) {
      w.completeError(e);
    }
    _waiters.clear();
  }
}
