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
    if (actionId == 'mock.media.toggle' || actionId == 'media.transport.playPause') {
      return _togglePlaying();
    }
    if (actionId.startsWith('mock.set:')) {
      final id = actionId.substring('mock.set:'.length);
      _set(id, params?['value']);
      return const ActionOutcome.success();
    }
    // Volume sliders (dashboard + media mixer) carry their level in params.value;
    // the action id names which channel. Reflect it so the slider tracks the drag.
    if (actionId == 'media.volume.set') {
      final v = params?['value'];
      if (v != null) _set('media.volume', v);
      return const ActionOutcome.success('Volume set');
    }
    if (actionId == 'media.volume.mute') {
      final muted = !(_state['media.muted'] == true);
      _set('media.muted', muted);
      return ActionOutcome.success(muted ? 'Muted' : 'Unmuted');
    }
    if (actionId == 'media.transport.pause') {
      _set('media.playing', false);
      final media = _state['media'];
      if (media is Map) {
        _set('media', {...media.cast<String, Object?>(), 'playing': false});
      }
      return const ActionOutcome.success('Paused');
    }
    // Real generic launcher/volume ids the live engine routes to plugins; Demo
    // Mode mirrors them so the same wired tiles give feedback offline.
    if (actionId == 'launch.app' || actionId == 'launch.url') {
      return ActionOutcome.success(
          'Launching ${_launchName(params?['target'] as String?)}');
    }
    if (actionId == 'volume.set') {
      final v = params?['value'];
      if (v != null) _set('media.volume', v);
      return const ActionOutcome.success('Volume set');
    }
    if (actionId == 'volume.mute') {
      final muted = !(_state['media.muted'] == true);
      _set('media.muted', muted);
      return ActionOutcome.success(muted ? 'Muted' : 'Unmuted');
    }
    return ActionOutcome.success(_friendly(actionId));
  }

  ActionOutcome _togglePlaying() {
    final media = _state['media'];
    var playing = true;
    if (media is Map) {
      playing = !(media['playing'] == true);
      _set('media', {...media.cast<String, Object?>(), 'playing': playing});
    }
    _set('media.playing', playing);
    return ActionOutcome.success(playing ? 'Playing' : 'Paused');
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

    // Temperatures gently wander around their nominals (°C); these drive the
    // dashboard/overview/gaming/notification gauges + their sparklines.
    final cpuTemp = (52 + 6 * math.sin(_phase) + (_rng.nextDouble() - 0.5) * 2)
        .clamp(30, 90);
    final gpuTemp =
        (61 + 7 * math.sin(_phase * 0.8 + 1) + (_rng.nextDouble() - 0.5) * 2)
            .clamp(35, 92);
    _set('sys.cpu.temp', _r1(cpuTemp));
    _set('sys.gpu.temp', _r1(gpuTemp));

    // Loads (%) — CPU/GPU/RAM utilisation drift for the metric tiles + gauges.
    _set('sys.cpu.load', _r1((_asD('sys.cpu.load') + _jitter(3)).clamp(4, 96)));
    _set('sys.gpu.load', _r1((_asD('sys.gpu.load') + _jitter(3)).clamp(4, 98)));
    _set('sys.ram', _r1((_asD('sys.ram') + _jitter(1.2)).clamp(30, 92)));

    // Network throughput / latency for System Control + Gaming.
    _set('net.download', _r1((_asD('net.download') + _jitter(6)).clamp(20, 940)));
    _set('net.upload', _r1((_asD('net.upload') + _jitter(2)).clamp(2, 200)));
    _set('net.ping', _r1((_asD('net.ping') + _jitter(2)).clamp(4, 90)));

    // Game FPS + power draw + room temps wander a touch.
    _set('game.fps', _r1((_asD('game.fps') + _jitter(4)).clamp(30, 240)));
    _set('home.energy.now',
        _r1((_asD('home.energy.now') + _jitter(8)).clamp(40, 500)));

    // Media player progress creeps forward while playing (wraps at the end).
    final media = _state['media'];
    if (media is Map && media['playing'] == true) {
      final progress =
          (((media['progress'] as num?)?.toDouble() ?? 0) + 0.01) % 1.0;
      final duration = (media['duration'] as num?)?.toDouble() ?? 200;
      _set('media', {
        ...media.cast<String, Object?>(),
        'progress': progress,
        'elapsed': (progress * duration).round(),
      });
    }

    _set('sys.clock', _clock12());
  }

  double _asD(String id) {
    final v = _state[id];
    return v is num ? v.toDouble() : 0;
  }

  double _jitter(double amp) => (_rng.nextDouble() - 0.5) * 2 * amp;

  double _r1(num v) => double.parse(v.toStringAsFixed(1));

  // 12-hour wall clock (e.g. "10:30 AM") to match the smart-home sys.clock binding.
  String _clock12() {
    final now = DateTime.now();
    final h = now.hour % 12 == 0 ? 12 : now.hour % 12;
    final mm = now.minute.toString().padLeft(2, '0');
    return '$h:$mm ${now.hour < 12 ? 'AM' : 'PM'}';
  }

  /// Human feedback for an action id. Covers the legacy demo verbs plus the
  /// dotted Wave 1 vocabulary (app.launch.*, media.transport.*, system.*, game.*,
  /// home.scene.*, launcher.open.*) generically so any tile gives sensible feedback.
  String _friendly(String actionId) {
    switch (actionId) {
      case 'system.lock':
        return 'Locked (demo)';
      case 'system.sleep':
        return 'Sleeping (demo)';
      case 'system.restart':
        return 'Restarting (demo)';
      case 'system.shutdown':
        return 'Shutting down (demo)';
      case 'system.logoff':
        return 'Logging off (demo)';
      case 'system.hibernate':
        return 'Hibernating (demo)';
      case 'media.transport.next':
        return 'Next track';
      case 'media.transport.previous':
        return 'Previous track';
      case 'mock.shuffle':
        return 'Shuffle';
      case 'mock.repeat':
        return 'Repeat';
      case 'mock.prev':
        return 'Previous track';
      case 'mock.next':
        return 'Next track';
    }
    // Dotted families → a readable verb + the trailing segment ("Title Cased").
    final dot = actionId.lastIndexOf('.');
    final tail = dot >= 0 ? actionId.substring(dot + 1) : actionId;
    final name = _titleCase(tail);
    if (actionId.startsWith('app.launch.') ||
        actionId.startsWith('launch.app:') ||
        actionId.startsWith('launcher.open.') ||
        actionId.startsWith('game.launch.')) {
      return 'Launching $name';
    }
    if (actionId.startsWith('home.scene.')) return '$name scene activated';
    if (actionId.startsWith('performance.setMode.')) {
      return '$name performance mode';
    }
    if (actionId.startsWith('game.profile.set.')) return '$name profile';
    if (actionId.startsWith('mock.scene.')) return '$name scene activated';
    return name;
  }

  /// A short, readable name for a launch target (URL or app path) for Demo-Mode
  /// feedback — drops the scheme, leading `www.`, and any trailing slash.
  String _launchName(String? target) {
    if (target == null || target.isEmpty) return 'app';
    var t = target.trim();
    final scheme = t.indexOf('://');
    if (scheme >= 0) t = t.substring(scheme + 3);
    if (t.startsWith('www.')) t = t.substring(4);
    if (t.endsWith('/')) t = t.substring(0, t.length - 1);
    return t.isEmpty ? 'app' : t;
  }

  String _titleCase(String s) {
    if (s.isEmpty) return s;
    return s
        .split(RegExp(r'[\s_:-]+'))
        .where((w) => w.isNotEmpty)
        .map((w) => w[0].toUpperCase() + w.substring(1))
        .join(' ');
  }
}
