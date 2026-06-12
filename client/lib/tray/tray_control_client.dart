/// Loopback privileged control-channel client (PROJ-109), the Desktop UI's half of
/// the engine's `transport.ControlChannel` (PROJ-144 / 2A §6 / ADR-0011). The tray
/// drives privileged engine ops — service lifecycle (status / pause / resume / quit)
/// and pairing-token issuance — over a channel that is NOT network-routable.
///
/// The wire protocol mirrors the engine byte-for-byte:
///   * one length-prefixed JSON [Envelope] frame per request (channel `control`),
///     `type` = the [ControlOp] string, `payload` = the op's inner request bytes
///     (Go `transport.ClientRequest`);
///   * one length-prefixed reply [Envelope] back, whose `payload` is a
///     `controlReply` `{ok, error?, data?}` (Go `transport.DecodeReply`).
///
/// Unlike the LAN session path, the control channel is plaintext — its only guard is
/// the loopback bind + per-connection peer re-check the engine enforces. We dial
/// 127.0.0.1 only; a control client is meaningful solely on the same host as the
/// engine.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import '../net/conn.dart';
import '../net/envelope.dart';
import '../net/framing.dart';

/// The privileged control op (the inner `type` of a control envelope). The wire
/// strings match the engine's `transport.ControlOp` constants exactly.
enum ControlOp {
  serviceStatus('service.status'),
  servicePause('service.pause'),
  serviceResume('service.resume'),
  serviceQuit('service.quit'),
  pairApprove('pair.approve'),
  auditRead('audit.read');

  const ControlOp(this.wire);

  /// The on-wire op string.
  final String wire;
}

/// A decoded control reply: the engine's `controlReply` `{ok, error, data}`.
class ControlReply {
  const ControlReply({required this.ok, this.error = '', this.data});

  /// Whether the op succeeded.
  final bool ok;

  /// The engine's error string when [ok] is false (empty otherwise).
  final String error;

  /// The op-specific result bytes (inner `data`), or null for ops with no result.
  final Uint8List? data;

  /// Decodes the inner `data` as a JSON object, or an empty map when absent.
  Map<String, dynamic> dataJson() {
    final d = data;
    if (d == null || d.isEmpty) return const {};
    final v = jsonDecode(utf8.decode(d));
    return v is Map<String, dynamic> ? v : const {};
  }
}

/// Raised when a control exchange fails at the transport level (dial / frame /
/// decode), as distinct from a well-formed `{ok:false}` engine reply.
class ControlChannelException implements Exception {
  ControlChannelException(this.message);
  final String message;
  @override
  String toString() => 'ControlChannelException($message)';
}

/// Dials a fresh loopback connection per call. The default dials 127.0.0.1 via a
/// [SocketConn]; tests inject an in-memory [duplexPipe] connection instead.
typedef ControlDialer = Future<DuplexConn> Function();

/// The default loopback host the control channel binds to (the engine binds
/// 127.0.0.1; see `transport.DefaultControlAddr`).
const String kControlLoopbackHost = '127.0.0.1';

/// A one-shot-per-request client for the engine's loopback control channel.
///
/// Each [request] opens a fresh connection, writes a single request frame, reads the
/// single reply frame, and closes — matching the engine's per-connection
/// request/response handler and avoiding any long-lived privileged socket. A serial
/// lock prevents overlapping dials so rapid menu clicks can't race.
class TrayControlClient {
  TrayControlClient({required ControlDialer dialer, Duration? timeout})
      : _dialer = dialer,
        _timeout = timeout ?? const Duration(seconds: 5);

  /// Builds a client that dials the engine on the loopback port over TCP.
  factory TrayControlClient.loopback(int port,
          {String host = kControlLoopbackHost, Duration? timeout}) =>
      TrayControlClient(
        dialer: () => SocketConn.connect(host, port,
            timeout: timeout ?? const Duration(seconds: 5)),
        timeout: timeout,
      );

  final ControlDialer _dialer;
  final Duration _timeout;
  Future<void> _gate = Future.value();

  /// Convenience: requests the engine run-state, returning its short label
  /// (e.g. "running" / "paused"). Throws on a transport error or `{ok:false}` reply.
  Future<String> status() async {
    final reply = await request(ControlOp.serviceStatus);
    if (!reply.ok) throw ControlChannelException(reply.error);
    return reply.dataJson()['state'] as String? ?? '';
  }

  /// Convenience: pauses the engine (stop serving sessions without exiting).
  Future<void> pause() => _expectOk(ControlOp.servicePause);

  /// Convenience: resumes after a [pause].
  Future<void> resume() => _expectOk(ControlOp.serviceResume);

  /// Convenience: requests a graceful engine shutdown.
  Future<void> quit() => _expectOk(ControlOp.serviceQuit);

  /// Convenience: mints a fresh single-use pairing token (for Show Pairing QR).
  Future<String> approvePairing() async {
    final reply = await request(ControlOp.pairApprove);
    if (!reply.ok) throw ControlChannelException(reply.error);
    return reply.dataJson()['token'] as String? ?? '';
  }

  Future<void> _expectOk(ControlOp op) async {
    final reply = await request(op);
    if (!reply.ok) throw ControlChannelException(reply.error);
  }

  /// Performs one request/response exchange for [op] with an optional inner JSON
  /// [payload]. Serialised so concurrent callers never share a connection.
  Future<ControlReply> request(ControlOp op, {Map<String, dynamic>? payload}) {
    final result = _gate.then((_) => _exchange(op, payload));
    // Keep the gate chained but never let a failed exchange poison it.
    _gate = result.then((_) {}, onError: (_) {});
    return result;
  }

  Future<ControlReply> _exchange(
      ControlOp op, Map<String, dynamic>? payload) async {
    final DuplexConn conn;
    try {
      conn = await _dialer().timeout(_timeout);
    } on TimeoutException {
      throw ControlChannelException('control dial timed out');
    } catch (e) {
      throw ControlChannelException('control dial failed: $e');
    }

    final frames = FrameChannel(conn);
    try {
      final reqBytes = payload == null
          ? null
          : Uint8List.fromList(utf8.encode(jsonEncode(payload)));
      final env = Envelope(
        ch: Channel.control,
        type: op.wire,
        ts: DateTime.now().millisecondsSinceEpoch,
        payload: reqBytes,
      );
      frames.write(env.marshal());

      final frame = await frames.read().timeout(_timeout);
      if (frame == null) {
        throw ControlChannelException('control connection closed before reply');
      }
      return _decodeReply(frame);
    } on TimeoutException {
      throw ControlChannelException('control reply timed out');
    } finally {
      await frames.close();
    }
  }

  /// Decodes a reply envelope frame into a [ControlReply] (mirrors the engine's
  /// `transport.DecodeReply`).
  static ControlReply _decodeReply(Uint8List frame) {
    final Envelope env;
    try {
      env = Envelope.unmarshal(frame);
    } catch (e) {
      throw ControlChannelException('malformed reply envelope: $e');
    }
    final Map<String, dynamic> r;
    try {
      r = jsonDecode(utf8.decode(env.payload)) as Map<String, dynamic>;
    } catch (e) {
      throw ControlChannelException('malformed control reply: $e');
    }
    final dataField = r['data'];
    return ControlReply(
      ok: r['ok'] == true,
      error: r['error'] as String? ?? '',
      // Go marshals the inner `data` json.RawMessage straight into the reply, so
      // here it is a nested JSON value — re-encode it to its raw bytes.
      data: dataField == null
          ? null
          : Uint8List.fromList(utf8.encode(jsonEncode(dataField))),
    );
  }
}
