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

  // The now-playing header (art + title/artist/visualizer) is the elastic block:
  // it's allowed to shrink (Flexible + scaleDown) so the player fits its cell even
  // when short, while the progress bar + transport row keep their intrinsic size.
  final header = Row(
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
  );

  return CardChrome(
    key: Key('media-player-${node.id}'),
    accent: accent,
    padding: const EdgeInsets.all(DeckSpacing.lg),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Header shrinks first (never striping) when the cell is short: it keeps
        // its bounded width (so the Expanded title column is happy) but is clipped
        // to whatever vertical space remains rather than overflowing the card.
        Flexible(child: ClipRect(child: header)),
        const SizedBox(height: DeckSpacing.md),
        _ProgressBar(
          id: node.id,
          progress: info.progress,
          accent: accent,
          elapsed: info.elapsed,
          duration: info.duration,
        ),
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
    this.elapsed,
    this.duration,
  });

  /// Playback progress 0..1 (clamped); 0 when unknown.
  final double progress;

  /// Optional elapsed seconds (host-authored); drives the `m:ss` time row.
  final double? elapsed;

  /// Optional track duration in seconds (host-authored).
  final double? duration;
}

/// Extracts player fields from a bound [value]: a `Map`
/// (`{track, artist, playing, progress, elapsed, duration}`) or a plain string
/// title; falls back to the node's style `track`/`artist` and shows "--" when
/// nothing is bound.
PlayerInfo playerInfoFromValue(Object? value, WidgetNode node) {
  final style = node.appearance.style;
  final styleTrack = style['track'] as String?;
  final styleArtist = style['artist'] as String?;
  // Duration may be authored in style for a static preview.
  final styleDuration = _seconds(style['duration']);

  if (value is Map) {
    final m = value.cast<Object?, Object?>();
    return PlayerInfo(
      track: _str(m['track']) ?? styleTrack ?? '--',
      artist: _str(m['artist']) ?? styleArtist ?? '',
      playing: m['playing'] == true,
      progress: _progress(m['progress']),
      elapsed: _seconds(m['elapsed']),
      duration: _seconds(m['duration']) ?? styleDuration,
    );
  }
  if (value is String && value.isNotEmpty) {
    return PlayerInfo(
      track: value,
      artist: styleArtist ?? '',
      playing: false,
      progress: 0,
      duration: styleDuration,
    );
  }
  return PlayerInfo(
    track: styleTrack ?? '--',
    artist: styleArtist ?? '',
    playing: false,
    progress: 0,
    duration: styleDuration,
  );
}

double? _seconds(Object? v) {
  if (v == null) return null;
  final n = v is num ? v.toDouble() : double.tryParse('$v');
  return (n != null && n.isFinite && n >= 0) ? n : null;
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
    this.elapsed,
    this.duration,
  });

  final String id;
  final double progress;
  final Color accent;

  /// Optional elapsed/duration in seconds (host-authored); when given the
  /// `m:ss / m:ss` time row is shown above the bar (matching the prototype).
  final double? elapsed;
  final double? duration;

  @override
  Widget build(BuildContext context) {
    final p = progress.clamp(0.0, 1.0);
    // Derive elapsed from progress×duration when only a duration is known.
    final elapsedSec = elapsed ?? (duration != null ? duration! * p : null);
    final timeStyle = DeckType.mono(fontSize: 10, color: DeckColors.textSecondary);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (duration != null) ...[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(_fmt(elapsedSec ?? 0), key: Key('player-elapsed-$id'), style: timeStyle),
              Text(_fmt(duration!), key: Key('player-duration-$id'), style: timeStyle),
            ],
          ),
          const SizedBox(height: DeckSpacing.xs),
        ],
        ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: Stack(
            children: [
              Container(
                key: Key('player-progress-$id'),
                height: 5,
                color: DeckColors.border,
              ),
              FractionallySizedBox(
                widthFactor: p,
                child: Container(
                  height: 5,
                  decoration: BoxDecoration(gradient: accentGradient()),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Formats a duration in seconds as `m:ss`.
  static String _fmt(double seconds) {
    final s = seconds.isFinite && seconds >= 0 ? seconds.round() : 0;
    final m = s ~/ 60;
    final r = s % 60;
    return '$m:${r.toString().padLeft(2, '0')}';
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
