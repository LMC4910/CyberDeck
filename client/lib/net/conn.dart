/// Raw duplex byte transport seam (PROJ-180). Keeping the connection minimal
/// (incoming byte stream + add + close) lets the encrypted session run over a real
/// `Socket` in production and over an in-memory pipe in tests — the same role the
/// Go `transport.Conn` interface plays.
library;

import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

/// A bidirectional raw byte stream.
abstract class DuplexConn {
  /// Inbound bytes (arbitrary chunking).
  Stream<Uint8List> get incoming;

  /// Queues outbound bytes.
  void add(List<int> bytes);

  /// Closes the connection.
  Future<void> close();
}

/// A [DuplexConn] backed by a dart:io [Socket] (production LAN transport).
class SocketConn implements DuplexConn {
  SocketConn(this._socket);

  final Socket _socket;

  /// Dials a TCP connection to host:port.
  static Future<SocketConn> connect(String host, int port,
      {Duration timeout = const Duration(seconds: 5)}) async {
    final socket = await Socket.connect(host, port, timeout: timeout);
    socket.setOption(SocketOption.tcpNoDelay, true);
    return SocketConn(socket);
  }

  @override
  Stream<Uint8List> get incoming => _socket;

  @override
  void add(List<int> bytes) => _socket.add(bytes);

  @override
  Future<void> close() async {
    await _socket.flush();
    await _socket.close();
    _socket.destroy();
  }
}

/// Creates a connected pair of in-memory connections (for tests): bytes written to
/// one surface on the other's [incoming].
(DuplexConn, DuplexConn) duplexPipe() {
  final a2b = StreamController<Uint8List>();
  final b2a = StreamController<Uint8List>();
  final a = _PipeConn(b2a.stream, a2b);
  final b = _PipeConn(a2b.stream, b2a);
  return (a, b);
}

class _PipeConn implements DuplexConn {
  _PipeConn(this._incoming, this._out);

  final Stream<Uint8List> _incoming;
  final StreamController<Uint8List> _out;

  @override
  Stream<Uint8List> get incoming => _incoming;

  @override
  void add(List<int> bytes) {
    if (!_out.isClosed) _out.add(Uint8List.fromList(bytes));
  }

  @override
  Future<void> close() async {
    // Fire-and-forget: a single-subscription controller's close() future does not
    // complete once its listener has been cancelled (the done event has nowhere to
    // go), which would deadlock a session teardown. Closing without awaiting is
    // correct here — the peer's read loop ends on the cancelled subscription.
    if (!_out.isClosed) unawaited(_out.close());
  }
}
