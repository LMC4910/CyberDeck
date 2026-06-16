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
import 'seed_decks.dart';

/// Maps an engine `system.*` telemetry id to the page binding id(s) the authored
/// pages use, so the client's own 7 pages light up with real engine data. Ids
/// the engine doesn't publish (CPU temp, fans, FPS, smart-home, …) are absent
/// here and their widgets render "--" live. `system.uptime` / `system.net.*` are
/// value-transformed in [_mapDelta] rather than a plain rename.
const Map<String, List<String>> _engineToPageIds = {
  'system.cpu.percent': ['sys.cpu.load'],
  'system.ram.percent': ['sys.ram'],
  'system.gpu.load': ['sys.gpu.load'],
  'system.gpu.temp': ['sys.gpu.temp'],
  'system.volume': ['media.volume', 'media.volume.system'],
  'system.muted': ['media.muted'],
  'notification.count': ['notification.count'],
  // Static host details map → the "Detailed System Info" card binding.
  'system.info': ['sys.info'],
  // Primary-disk usage → the Storage Overview donut (a %, not the TB tile).
  'system.disk.percent': ['sys.storage.usedPct'],
  // Per-drive storage (renames; absent drives never publish → those slots "--").
  'system.disk.c.percent': ['storage.c.percent'],
  'system.disk.d.percent': ['storage.d.percent'],
  'system.disk.e.percent': ['storage.e.percent'],
  'system.disk.f.percent': ['storage.f.percent'],
};

/// Maps one engine state delta to the page binding id(s) it should drive. Emits
/// the original id too (so a widget binding the engine id directly still works),
/// then any mapped ids — with value transforms for uptime (seconds → text) and
/// network throughput (bytes/s → Mbps). Top-level + pure so it's unit-testable.
List<StateUpdate> mapEngineStateDelta(String engineId, Object? value) {
  final out = <StateUpdate>[StateUpdate(engineId, value)];
  switch (engineId) {
    case 'system.uptime':
      out.add(StateUpdate('sys.uptime', formatUptimeSeconds(value)));
      return out;
    // RAM byte breakdown → the "X.X GB" text the stat rows show.
    case 'system.ram.used':
      out.add(StateUpdate('sys.ram.used', formatGiB(value)));
      return out;
    case 'system.ram.free':
      out.add(StateUpdate('sys.ram.free', formatGiB(value)));
      return out;
    case 'system.ram.total':
      out.add(StateUpdate('sys.ram.total', formatGiB(value)));
      return out;
    // Network split (bytes/s → Mbps). `net.ping` has no engine source → "--".
    case 'system.net.rx':
      out.add(StateUpdate('net.download', bytesPerSecToMbps(value)));
      return out;
    case 'system.net.tx':
      out.add(StateUpdate('net.upload', bytesPerSecToMbps(value)));
      return out;
    // Top processes [{name,cpu}] → list-card rows [{label, value:"x.x%"}].
    case 'system.processes':
      out.add(StateUpdate('sys.processes', processRows(value)));
      return out;
  }
  for (final pageId in _engineToPageIds[engineId] ?? const <String>[]) {
    out.add(StateUpdate(pageId, value));
  }
  return out;
}

/// Formats engine uptime seconds as "Dd Hh Mm Ss" (drops leading zero units).
String formatUptimeSeconds(Object? v) {
  final total = v is num ? v.toInt() : int.tryParse('$v') ?? 0;
  final d = total ~/ 86400;
  final h = (total % 86400) ~/ 3600;
  final m = (total % 3600) ~/ 60;
  final s = total % 60;
  if (d > 0) return '${d}d ${h}h ${m}m ${s}s';
  if (h > 0) return '${h}h ${m}m ${s}s';
  return '${m}m ${s}s';
}

/// Converts bytes/sec → Mbps for the network readout.
double bytesPerSecToMbps(Object? v) {
  final b = v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
  return (b * 8) / 1e6;
}

/// Formats a byte count as "X.X GB" (GiB) for the RAM stat rows.
String formatGiB(Object? v) {
  final b = v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
  return '${(b / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
}

/// Transforms the engine's top-processes list `[{name, cpu}]` into the
/// list-card row shape `[{label, value:"x.x%"}]`.
List<Map<String, dynamic>> processRows(Object? v) {
  if (v is! List) return const [];
  return [
    for (final e in v)
      if (e is Map)
        {
          'label': '${e['name'] ?? ''}',
          'value':
              '${(e['cpu'] is num ? (e['cpu'] as num).toDouble() : 0.0).toStringAsFixed(1)}%',
        },
  ];
}

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
    // The client owns the layouts (its 7 authored pages), so the deck is
    // renderable immediately — no need to wait for an engine layout snapshot.
    if (!_readyC.isCompleted) _readyC.complete();
  }

  EngineConnection _conn;
  final Future<EngineConnection> Function()? _reconnect;

  final _statusN = ValueNotifier<ConnStatus>(ConnStatus.connected);
  final _ctrl = StreamController<StateUpdate>.broadcast();
  final _readyC = Completer<void>();
  final Map<String, Object?> _snapshotState = {};

  // The client renders its OWN authored pages live (same as Demo Mode); the
  // engine drives them via real telemetry. `_overrides` holds session-local
  // Designer edits (engine-side persistence is a follow-up).
  final List<SeedDeck> _seed = seedDecks();
  final Map<String, LayoutPage> _overrides = {};

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
  List<DeckSummary> decks() => [for (final d in _seed) d.summary];

  @override
  LayoutPage layout(String deckId) =>
      _overrides[deckId] ??
      _seed
          .firstWhere((d) => d.summary.id == deckId,
              orElse: () => _seed.first)
          .page;

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
    _overrides[deckId] = page; // session-local preview; engine persistence is a follow-up.
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

  // The client renders its own authored pages, so engine layout snapshots/ops are
  // ignored for layout; we only note inbound traffic to keep the watchdog happy.
  void _onLayout(Envelope env) => _lastInbound = DateTime.now();

  void _onState(Envelope env) {
    _lastInbound = DateTime.now();
    try {
      final m = jsonDecode(utf8.decode(env.payload)) as Map<String, dynamic>;
      final id = m['id'] as String?;
      if (id == null) return;
      // Translate the engine's `system.*` telemetry into the page binding ids
      // (+ passthrough), so the authored pages light up with real data.
      for (final u in _mapDelta(id, m['value'])) {
        _snapshotState[u.id] = u.value;
        if (!_ctrl.isClosed) _ctrl.add(u);
      }
    } catch (_) {}
  }

  Iterable<StateUpdate> _mapDelta(String engineId, Object? value) =>
      mapEngineStateDelta(engineId, value);

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
