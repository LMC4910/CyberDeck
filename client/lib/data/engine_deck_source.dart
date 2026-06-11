/// Live data source backed by a paired Go engine: wraps an [EngineConnection],
/// decoding `layout.snapshot` + `state.delta`, forwarding interactions, and keeping
/// the link healthy — a heartbeat ping, an inbound watchdog, and bounded
/// auto-reconnect (tokenless, via the injected [reconnect] callback). Designer edits
/// are local-preview only (engine-side persistence is a follow-up).
library;

import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../net/connection_manager.dart';
import '../net/envelope.dart';
import '../render/model.dart';
import 'deck_source.dart';

/// How often the client pings the engine (keeps the engine reaper happy too).
const _pingInterval = Duration(seconds: 5);

/// No inbound traffic for this long ⇒ the link is presumed dead ⇒ reconnect.
const _watchdogTimeout = Duration(seconds: 12);

class EngineDeckSource implements DeckSource {
  EngineDeckSource(this._conn, {Future<EngineConnection> Function()? reconnect})
      // ignore: prefer_initializing_formals (private field, public named param)
      : _reconnect = reconnect {
    _bind();
    _startTimers();
  }

  EngineConnection _conn;
  final Future<EngineConnection> Function()? _reconnect;

  final _statusN = ValueNotifier<ConnStatus>(ConnStatus.connected);
  final _ctrl = StreamController<StateUpdate>.broadcast();
  final _readyC = Completer<void>();
  final Map<String, Object?> _snapshotState = {};
  LayoutPage _live = const LayoutPage(id: 'live');

  List<StreamSubscription<Envelope>> _subs = [];
  Timer? _pingTimer;
  Timer? _watchdog;
  DateTime _lastInbound = DateTime.now();
  bool _reconnecting = false;
  bool _disposed = false;

  /// Completes when the first layout snapshot has arrived (the deck is renderable).
  Future<void> get ready => _readyC.future;

  @override
  String get label => _conn.engineUuid;

  @override
  ValueListenable<ConnStatus> get status => _statusN;

  @override
  List<DeckSummary> decks() =>
      [DeckSummary(id: 'live', title: 'Live Deck', subtitle: _conn.engineUuid)];

  @override
  LayoutPage layout(String deckId) => _live;

  @override
  Stream<StateUpdate> states() async* {
    for (final e in _snapshotState.entries) {
      yield StateUpdate(e.key, e.value);
    }
    yield* _ctrl.stream;
  }

  @override
  Future<ActionOutcome> invoke(String actionId, {Map<String, dynamic>? params}) async {
    try {
      await _sendControl('interaction', {'actionId': actionId, 'params': ?params});
      return const ActionOutcome.success();
    } catch (e) {
      _onDropped();
      return ActionOutcome.failure('$e');
    }
  }

  @override
  void saveDeck(String deckId, LayoutPage page) {
    _live = page; // local preview; engine-side persistence is a follow-up.
  }

  @override
  Future<void> dispose() async {
    _disposed = true;
    _cancelTimers();
    for (final s in _subs) {
      await s.cancel();
    }
    _statusN.dispose();
    await _ctrl.close();
    await _conn.close();
  }

  // --- internals ---

  void _bind() {
    _subs = [
      _conn.router.layout.listen(_onLayout, onError: (_) {}, onDone: _onDropped),
      _conn.router.state.listen(_onState, onError: (_) {}),
      _conn.router.control.listen(_onControl, onError: (_) {}),
    ];
  }

  void _startTimers() {
    _lastInbound = DateTime.now();
    _pingTimer = Timer.periodic(_pingInterval, (_) => _ping());
    _watchdog = Timer.periodic(const Duration(seconds: 2), (_) {
      if (DateTime.now().difference(_lastInbound) > _watchdogTimeout) _onDropped();
    });
  }

  void _cancelTimers() {
    _pingTimer?.cancel();
    _watchdog?.cancel();
    _pingTimer = null;
    _watchdog = null;
  }

  Future<void> _ping() async {
    try {
      await _sendControl('ping', const {});
    } catch (_) {
      _onDropped();
    }
  }

  /// Requests a fresh snapshot + state burst (resync, PROJ-149).
  Future<void> requestResync() => _sendControl('resync', const {});

  Future<void> _sendControl(String type, Map<String, dynamic> body) {
    final payload = utf8.encode(jsonEncode(body));
    return _conn.router.send(Channel.control, type, payload);
  }

  void _onControl(Envelope env) => _lastInbound = DateTime.now(); // pong / etc.

  void _onLayout(Envelope env) {
    _lastInbound = DateTime.now();
    if (env.type != 'layout.snapshot') return; // incremental ops: follow-up
    try {
      final m = jsonDecode(utf8.decode(env.payload)) as Map<String, dynamic>;
      _live = LayoutPage.fromJson(m);
      if (!_readyC.isCompleted) _readyC.complete();
    } catch (_) {}
  }

  void _onState(Envelope env) {
    _lastInbound = DateTime.now();
    try {
      final m = jsonDecode(utf8.decode(env.payload)) as Map<String, dynamic>;
      final id = m['id'] as String?;
      if (id != null) {
        _snapshotState[id] = m['value'];
        if (!_ctrl.isClosed) _ctrl.add(StateUpdate(id, m['value']));
      }
    } catch (_) {}
  }

  // The link dropped (stream closed / watchdog / send error) → try to reconnect.
  void _onDropped() {
    if (_disposed || _reconnecting) return;
    if (_reconnect == null) {
      _statusN.value = ConnStatus.disconnected;
      return;
    }
    unawaited(_reconnectLoop());
  }

  Future<void> _reconnectLoop() async {
    _reconnecting = true;
    _statusN.value = ConnStatus.connecting;
    _cancelTimers();
    for (final s in _subs) {
      await s.cancel();
    }
    unawaited(_conn.close()); // best-effort close the dead connection

    var delay = const Duration(milliseconds: 500);
    while (!_disposed) {
      try {
        _conn = await _reconnect!();
        _bind();
        _startTimers();
        _statusN.value = ConnStatus.connected;
        _reconnecting = false;
        unawaited(requestResync()); // belt-and-suspenders; new session also re-serves
        return;
      } catch (_) {
        _statusN.value = ConnStatus.disconnected;
        await Future<void>.delayed(delay);
        delay = Duration(
            milliseconds: math.min(delay.inMilliseconds * 2, 8000));
        _statusN.value = ConnStatus.connecting;
      }
    }
    _reconnecting = false;
  }
}
