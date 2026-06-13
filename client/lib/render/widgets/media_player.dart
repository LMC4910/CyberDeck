/// Rich media-player widget (Wave 1 / C2): a full now-playing panel — album art
/// to the left, a bold title + muted artist, a decorative animated VISUALIZER
/// bar, a progress bar, and a transport row (prev / a large glowing circular
/// play-pause / next, plus shuffle + repeat). It is the showpiece audio control
/// of the deck; [media.card] stays the compact variant.
///
/// Host-authoritative like every interactive widget: the title/artist/playing/
/// progress all follow the bound `media.*` state (a Map with `track`/`artist`/
/// `playing`/`progress` 0..1, or a plain string title); the transport buttons
/// only EMIT slots — `previous`, `playPause`, `next`, `shuffle`, `repeat` — which
/// PROJ-187 maps to `media.transport.*`. The visualizer animates only while
/// `playing` is true (and freezes when not), so it decorates without faking data.
/// `style.albumArt` paints the art (procedural gradient fallback).
/// Registered as `media.player`.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../model.dart';
import '../registry.dart';
import 'media_card.dart' show MediaInfo;
import 'widget_theme.dart';

/// Builds a rich media player from a render context (the registry builder).
Widget buildMediaPlayer(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final accent = resolveAccent(node.appearance.style);
  final info = playerInfoFromValue(ctx.value, node);

  return CardChrome(
    key: Key('media-player-${node.id}'),
    accent: accent,
    padding: const EdgeInsets.all(DeckSpacing.lg),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _AlbumArt(
              id: node.id,
              asset: node.appearance.style['albumArt'] as String?,
              accent: accent,
            ),
            const SizedBox(width: DeckSpacing.lg),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    info.track,
                    key: Key('player-track-${node.id}'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: DeckType.heading(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    info.artist,
                    key: Key('player-artist-${node.id}'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: DeckType.body(
                      fontSize: 13,
                      color: DeckColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: DeckSpacing.sm),
                  _Visualizer(
                    id: node.id,
                    playing: info.playing,
                    accent: accent,
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: DeckSpacing.md),
        _ProgressBar(id: node.id, progress: info.progress, accent: accent),
        const SizedBox(height: DeckSpacing.md),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _MiniButton(
              id: node.id,
              slot: 'shuffle',
              icon: Icons.shuffle,
              onTap: () => ctx.emit('shuffle'),
            ),
            _MiniButton(
              id: node.id,
              slot: 'previous',
              icon: Icons.skip_previous,
              onTap: () => ctx.emit('previous'),
            ),
            _PlayButton(
              id: node.id,
              playing: info.playing,
              accent: accent,
              onTap: () => ctx.emit('playPause'),
            ),
            _MiniButton(
              id: node.id,
              slot: 'next',
              icon: Icons.skip_next,
              onTap: () => ctx.emit('next'),
            ),
            _MiniButton(
              id: node.id,
              slot: 'repeat',
              icon: Icons.repeat,
              onTap: () => ctx.emit('repeat'),
            ),
          ],
        ),
      ],
    ),
  );
}

/// Now-playing fields for the rich player (extends [MediaInfo] with progress).
class PlayerInfo extends MediaInfo {
  const PlayerInfo({
    required super.track,
    required super.artist,
    required super.playing,
    required this.progress,
  });

  /// Playback progress 0..1 (clamped); 0 when unknown.
  final double progress;
}

/// Extracts player fields from a bound [value]: a `Map`
/// (`{track, artist, playing, progress}`) or a plain string title; falls back to
/// the node's style `track`/`artist` and shows "--" when nothing is bound.
PlayerInfo playerInfoFromValue(Object? value, WidgetNode node) {
  final style = node.appearance.style;
  final styleTrack = style['track'] as String?;
  final styleArtist = style['artist'] as String?;

  if (value is Map) {
    final m = value.cast<Object?, Object?>();
    return PlayerInfo(
      track: _str(m['track']) ?? styleTrack ?? '--',
      artist: _str(m['artist']) ?? styleArtist ?? '',
      playing: m['playing'] == true,
      progress: _progress(m['progress']),
    );
  }
  if (value is String && value.isNotEmpty) {
    return PlayerInfo(
      track: value,
      artist: styleArtist ?? '',
      playing: false,
      progress: 0,
    );
  }
  return PlayerInfo(
    track: styleTrack ?? '--',
    artist: styleArtist ?? '',
    playing: false,
    progress: 0,
  );
}

String? _str(Object? v) {
  if (v == null) return null;
  final s = '$v';
  return s.isEmpty ? null : s;
}

double _progress(Object? v) {
  final n = v is num ? v.toDouble() : double.tryParse('$v');
  if (n == null) return 0;
  return n.clamp(0.0, 1.0);
}

class _AlbumArt extends StatelessWidget {
  const _AlbumArt({required this.id, required this.asset, required this.accent});

  final String id;
  final String? asset;
  final Color accent;

  static const double _size = 64;

  @override
  Widget build(BuildContext context) {
    final fallback = DecoratedBox(
      key: Key('player-art-fallback-$id'),
      decoration: BoxDecoration(gradient: accentGradient()),
      child: const Center(
        child: Icon(Icons.album, color: Colors.white, size: 28),
      ),
    );
    return SizedBox(
      width: _size,
      height: _size,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(DeckSpacing.radius),
          boxShadow: neonGlow(accent, intensity: 0.5),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(DeckSpacing.radius),
          child: (asset != null && asset!.isNotEmpty)
              ? Image.asset(
                  asset!,
                  key: Key('player-art-$id'),
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stack) => fallback,
                )
              : fallback,
        ),
      ),
    );
  }
}

/// A decorative animated equalizer: a row of bars whose heights breathe while
/// [playing]; frozen (flat-ish, static) when paused. Purely cosmetic — it never
/// represents real audio data.
class _Visualizer extends StatefulWidget {
  const _Visualizer({required this.id, required this.playing, required this.accent});

  final String id;
  final bool playing;
  final Color accent;

  @override
  State<_Visualizer> createState() => _VisualizerState();
}

class _VisualizerState extends State<_Visualizer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  static const int _bars = 14;
  late final List<double> _phase;

  @override
  void initState() {
    super.initState();
    final rnd = math.Random(7);
    _phase = [for (var i = 0; i < _bars; i++) rnd.nextDouble() * math.pi * 2];
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    );
    if (widget.playing) _c.repeat();
  }

  @override
  void didUpdateWidget(covariant _Visualizer old) {
    super.didUpdateWidget(old);
    if (widget.playing && !_c.isAnimating) {
      _c.repeat();
    } else if (!widget.playing && _c.isAnimating) {
      _c.stop();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      key: Key('player-visualizer-${widget.id}'),
      height: 22,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          return CustomPaint(
            painter: _VisualizerPainter(
              t: _c.value,
              phase: _phase,
              accent: widget.accent,
              playing: widget.playing,
            ),
            size: Size.infinite,
          );
        },
      ),
    );
  }
}

class _VisualizerPainter extends CustomPainter {
  _VisualizerPainter({
    required this.t,
    required this.phase,
    required this.accent,
    required this.playing,
  });

  final double t;
  final List<double> phase;
  final Color accent;
  final bool playing;

  @override
  void paint(Canvas canvas, Size size) {
    final n = phase.length;
    if (n == 0 || size.width <= 0) return;
    const gap = 3.0;
    final barW = (size.width - gap * (n - 1)) / n;
    if (barW <= 0) return;
    final paint = Paint()..color = accent;
    for (var i = 0; i < n; i++) {
      final wave = playing
          ? (math.sin(t * math.pi * 2 + phase[i]) * 0.5 + 0.5)
          : 0.22; // frozen low bars when paused
      final h = (0.18 + 0.82 * wave) * size.height;
      final x = i * (barW + gap);
      final r = RRect.fromRectAndRadius(
        Rect.fromLTWH(x, size.height - h, barW, h),
        const Radius.circular(1.5),
      );
      canvas.drawRRect(r, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _VisualizerPainter old) =>
      old.t != t || old.playing != playing || old.accent != accent;
}

class _ProgressBar extends StatelessWidget {
  const _ProgressBar({
    required this.id,
    required this.progress,
    required this.accent,
  });

  final String id;
  final double progress;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(3),
      child: Stack(
        children: [
          Container(
            key: Key('player-progress-$id'),
            height: 5,
            color: DeckColors.border,
          ),
          FractionallySizedBox(
            widthFactor: progress.clamp(0.0, 1.0),
            child: Container(
              height: 5,
              decoration: BoxDecoration(gradient: accentGradient()),
            ),
          ),
        ],
      ),
    );
  }
}

class _PlayButton extends StatelessWidget {
  const _PlayButton({
    required this.id,
    required this.playing,
    required this.accent,
    required this.onTap,
  });

  final String id;
  final bool playing;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: playing ? 'Pause' : 'Play',
      child: InkResponse(
        key: Key('player-playPause-$id'),
        onTap: onTap,
        radius: DeckSpacing.minTouchTarget / 2,
        child: Container(
          width: DeckSpacing.minTouchTarget,
          height: DeckSpacing.minTouchTarget,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: accentGradient(),
            boxShadow: neonGlow(accent),
          ),
          child: Icon(
            playing ? Icons.pause : Icons.play_arrow,
            color: Colors.white,
            size: 26,
          ),
        ),
      ),
    );
  }
}

class _MiniButton extends StatelessWidget {
  const _MiniButton({
    required this.id,
    required this.slot,
    required this.icon,
    required this.onTap,
  });

  final String id;
  final String slot;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      key: Key('player-$slot-$id'),
      icon: Icon(icon),
      color: DeckColors.textSecondary,
      iconSize: 20,
      constraints: const BoxConstraints(
        minWidth: DeckSpacing.minTouchTarget,
        minHeight: DeckSpacing.minTouchTarget,
      ),
      onPressed: onTap,
    );
  }
}
