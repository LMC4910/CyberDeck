/// Client channel routing (PROJ-180), the modest client-side counterpart to the
/// engine's `transport.ChannelMux` (PROJ-143): inbound envelopes are demuxed by
/// channel into separate streams, and outbound sends stamp a per-channel monotonic
/// seq. The heavy coalesce/drop backpressure policies live engine-side (the engine
/// is the authority on what to send); the client consumes ordered deltas/ops and
/// applies them.
library;

import 'dart:async';
import 'dart:typed_data';

import 'encrypted_session.dart';
import 'envelope.dart';

/// Splits a session's inbound envelopes into per-channel streams and stamps
/// outbound envelopes with per-channel sequence numbers.
class ChannelRouter {
  ChannelRouter(this._session) {
    _sub = _session.received.listen(_route, onDone: _closeAll);
  }

  final EncryptedSession _session;
  final SeqCounter _seq = SeqCounter();
  late final StreamSubscription<Envelope> _sub;

  final _controllers = <Channel, StreamController<Envelope>>{
    for (final c in Channel.values) c: StreamController<Envelope>.broadcast(),
  };

  /// Inbound state-channel envelopes (coalesced deltas).
  Stream<Envelope> get state => _controllers[Channel.state]!.stream;

  /// Inbound layout-channel envelopes (ordered, lossless ops).
  Stream<Envelope> get layout => _controllers[Channel.layout]!.stream;

  /// Inbound preview-channel envelopes.
  Stream<Envelope> get preview => _controllers[Channel.preview]!.stream;

  /// Inbound control-channel envelopes (loopback-privileged).
  Stream<Envelope> get control => _controllers[Channel.control]!.stream;

  /// Sends an inner message on a channel, stamping the next seq + timestamp.
  Future<void> send(Channel ch, String type, List<int> payload) {
    return _session.send(Envelope(
      ch: ch,
      type: type,
      seq: _seq.next(ch),
      ts: DateTime.now().millisecondsSinceEpoch,
      payload: Uint8List.fromList(payload),
    ));
  }

  void _route(Envelope env) {
    final c = _controllers[env.ch];
    if (c != null && !c.isClosed) c.add(env);
  }

  void _closeAll() {
    for (final c in _controllers.values) {
      if (!c.isClosed) c.close();
    }
  }

  /// Stops routing and closes the per-channel streams.
  Future<void> close() async {
    await _sub.cancel();
    _closeAll();
  }
}
