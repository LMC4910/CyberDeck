/// Demo Mode data source: serves the seed decks, generates believable live
/// telemetry, and handles actions locally — so the whole app is usable and testable
/// with no engine, no pairing, no network.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../render/model.dart';
import 'deck_source.dart';
import 'seed_decks.dart';

class MockDeckSource implements DeckSource {
  MockDeckSource() {
    for (final d in seedDecks()) {
      _summaries.add(d.summary);
      _pages[d.summary.id] = d.page;
    }
    _state.addAll(seedInitialState());
    _start();
  }

  final _statusN = ValueNotifier<ConnStatus>(ConnStatus.demo);
  final _ctrl = StreamController<StateUpdate>.broadcast();
  final List<DeckSummary> _summaries = [];
  final Map<String, LayoutPage> _pages = {};
  final Map<String, Object?> _state = {};
  final _rng = math.Random(42);
  Timer? _timer;
  double _phase = 0;

  @override
  String get label => 'Demo Mode';

  @override
  ValueListenable<ConnStatus> get status => _statusN;

  @override
  List<DeckSummary> decks() => List.unmodifiable(_summaries);

  @override
  LayoutPage layout(String deckId) =>
      _pages[deckId] ?? const LayoutPage(id: 'empty');

  @override
  Stream<StateUpdate> states() async* {
    // Current snapshot first (so a freshly opened deck shows values immediately)…
    for (final e in _state.entries) {
      yield StateUpdate(e.key, e.value);
    }
    // …then live updates.
    yield* _ctrl.stream;
  }

  @override
  Future<ActionOutcome> invoke(String actionId, {Map<String, dynamic>? params}) async {
    if (actionId.startsWith('mock.toggle:')) {
      final id = actionId.substring('mock.toggle:'.length);
      final next = !(_state[id] == true);
      _set(id, next);
      return ActionOutcome.success(next ? 'On' : 'Off');
    }
    if (actionId == 'mock.media.toggle') {
      final media = _state['media'];
      if (media is Map) {
        final playing = !(media['playing'] == true);
        _set('media', {...media.cast<String, Object?>(), 'playing': playing});
        return ActionOutcome.success(playing ? 'Playing' : 'Paused');
      }
      return const ActionOutcome.success();
    }
    if (actionId.startsWith('mock.set:')) {
      final id = actionId.substring('mock.set:'.length);
      final v = params?['value'];
      _set(id, v);
      return const ActionOutcome.success();
    }
    return ActionOutcome.success(_friendly(actionId));
  }

  @override
  void saveDeck(String deckId, LayoutPage page) => _pages[deckId] = page;

  @override
  Future<void> dispose() async {
    _timer?.cancel();
    await _ctrl.close();
    _statusN.dispose();
  }

  // --- internals ---

  void _set(String id, Object? value) {
    _state[id] = value;
    if (!_ctrl.isClosed) _ctrl.add(StateUpdate(id, value));
  }

  void _start() {
    _timer = Timer.periodic(const Duration(milliseconds: 500), (_) => _tick());
  }

  void _tick() {
    _phase += 0.18;
    // Home dashboard System Monitor: temps gently wander around their nominals;
    // RAM (GB) drifts. These drive the live gauge arcs + centre values.
    final cpuTemp = (42 + 4 * math.sin(_phase) + (_rng.nextDouble() - 0.5) * 2)
        .clamp(30, 90);
    final gpuTemp = (55 + 5 * math.sin(_phase * 0.8 + 1) + (_rng.nextDouble() - 0.5) * 2)
        .clamp(35, 92);
    final ramGb = (_asD('sys.ram') + (_rng.nextDouble() - 0.5) * 0.6).clamp(8, 30);
    _set('sys.cpu.temp', double.parse(cpuTemp.toStringAsFixed(1)));
    _set('sys.gpu.temp', double.parse(gpuTemp.toStringAsFixed(1)));
    _set('sys.ram', double.parse(ramGb.toStringAsFixed(1)));

    // Media player progress creeps forward while playing (wraps at the end).
    final media = _state['media'];
    if (media is Map && media['playing'] == true) {
      final next = {
        ...media.cast<String, Object?>(),
        'progress': (((media['progress'] as num?)?.toDouble() ?? 0) + 0.01) % 1.0,
      };
      _set('media', next);
    }

    // Legacy ids for the simpler media/home decks.
    final cpu = (45 + 30 * math.sin(_phase) + _rng.nextDouble() * 12).clamp(2, 99);
    final disk = (_asD('sys.disk') + (_rng.nextDouble() - 0.5) * 0.6).clamp(40, 95);
    _set('sys.cpu', double.parse(cpu.toStringAsFixed(1)));
    _set('sys.disk', double.parse(disk.toStringAsFixed(1)));
    _set('sys.clock', _clock());
  }

  double _asD(String id) {
    final v = _state[id];
    return v is num ? v.toDouble() : 0;
  }

  String _clock() {
    final now = DateTime.now();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(now.hour)}:${two(now.minute)}:${two(now.second)}';
  }

  String _friendly(String actionId) {
    switch (actionId) {
      case 'system.lock':
        return 'Locked (demo)';
      case 'system.sleep':
        return 'Sleeping (demo)';
      case 'launch.terminal':
        return 'Launching Terminal';
      case 'launch.files':
        return 'Opening File Explorer';
      case 'launch.control':
        return 'Opening Control Panel';
      case 'launch.app:disney':
        return 'Launching Disney+';
      case 'launch.app:prime':
        return 'Launching Prime Video';
      case 'launch.app:netflix':
        return 'Launching Netflix';
      case 'launch.app:chrome':
        return 'Launching Chrome';
      case 'launch.app:chatgpt':
        return 'Launching ChatGPT';
      case 'mock.shuffle':
        return 'Shuffle';
      case 'mock.repeat':
        return 'Repeat';
      case 'mock.prev':
        return 'Previous track';
      case 'mock.next':
        return 'Next track';
      case 'mock.scene.movie':
        return 'Movie scene activated';
      case 'mock.scene.night':
        return 'Night scene activated';
      default:
        return actionId;
    }
  }
}
