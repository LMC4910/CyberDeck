/// Media card widget (PROJ-186): a now-playing card showing track + artist text
/// with play/pause/next transport controls. The text follows the bound `media.*`
/// state (host authority): the widget's `stateBinding` carries the now-playing
/// payload (a `Map` with `track`/`artist`/`playing`, or a plain string title),
/// and the transport buttons emit interaction slots — `playPause`, `next`,
/// `previous` — which PROJ-187 maps to `media.transport.*` actions. The card
/// never mutates playback locally; it reflects what the host reports.
/// Registered as `media.card`.
library;

import 'package:flutter/material.dart';

import '../../theme/tokens.dart';
import '../model.dart';
import '../registry.dart';
import 'widget_theme.dart';

/// Builds a media card from a render context (the registry builder).
Widget buildMediaCard(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final accent = resolveAccent(node.appearance.style);
  final info = mediaInfoFromValue(ctx.value, node);

  final transport = Row(
    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
    children: [
      _TransportButton(
        id: node.id,
        slot: 'previous',
        icon: Icons.skip_previous,
        accent: accent,
        onTap: () => ctx.emit('previous'),
      ),
      _TransportButton(
        id: node.id,
        slot: 'playPause',
        icon: info.playing ? Icons.pause : Icons.play_arrow,
        accent: accent,
        onTap: () => ctx.emit('playPause'),
      ),
      _TransportButton(
        id: node.id,
        slot: 'next',
        icon: Icons.skip_next,
        accent: accent,
        onTap: () => ctx.emit('next'),
      ),
    ],
  );

  return DecoratedBox(
    key: Key('media-card-${node.id}'),
    decoration: BoxDecoration(
      color: DeckColors.card,
      border: Border.all(color: DeckColors.border),
      borderRadius: BorderRadius.circular(DeckSpacing.radius),
    ),
    child: ClipRRect(
      borderRadius: BorderRadius.circular(DeckSpacing.radius),
      child: Padding(
        padding: const EdgeInsets.all(DeckSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Flexible(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      info.track,
                      key: Key('media-track-${node.id}'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: DeckColors.textPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      info.artist,
                      key: Key('media-artist-${node.id}'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: DeckColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: DeckSpacing.sm),
            // Transport keeps its touch-target size but scales down (never
            // striping) when the cell is too short for the full row.
            Flexible(
              child: FittedBox(fit: BoxFit.scaleDown, child: transport),
            ),
          ],
        ),
      ),
    ),
  );
}

/// The now-playing fields the card renders.
class MediaInfo {
  const MediaInfo({
    required this.track,
    required this.artist,
    required this.playing,
  });

  final String track;
  final String artist;
  final bool playing;
}

/// Extracts now-playing fields from a bound [value]. Accepts a `Map`
/// (`{track, artist, playing}`) — the host's typed now-playing payload — or a
/// plain string title; falls back to the node's style `track`/`artist` defaults
/// and shows "--" when nothing is bound yet.
MediaInfo mediaInfoFromValue(Object? value, WidgetNode node) {
  final style = node.appearance.style;
  final styleTrack = style['track'] as String?;
  final styleArtist = style['artist'] as String?;

  if (value is Map) {
    final m = value.cast<Object?, Object?>();
    return MediaInfo(
      track: _str(m['track']) ?? styleTrack ?? '--',
      artist: _str(m['artist']) ?? styleArtist ?? '',
      playing: m['playing'] == true,
    );
  }
  if (value is String && value.isNotEmpty) {
    return MediaInfo(track: value, artist: styleArtist ?? '', playing: false);
  }
  return MediaInfo(
    track: styleTrack ?? '--',
    artist: styleArtist ?? '',
    playing: false,
  );
}

String? _str(Object? v) {
  if (v == null) return null;
  final s = '$v';
  return s.isEmpty ? null : s;
}

class _TransportButton extends StatelessWidget {
  const _TransportButton({
    required this.id,
    required this.slot,
    required this.icon,
    required this.accent,
    required this.onTap,
  });

  final String id;
  final String slot;
  final IconData icon;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      key: Key('media-$slot-$id'),
      icon: Icon(icon),
      color: accent,
      // WCAG 2.5.5 minimum touch target.
      constraints: const BoxConstraints(
        minWidth: DeckSpacing.minTouchTarget,
        minHeight: DeckSpacing.minTouchTarget,
      ),
      onPressed: onTap,
    );
  }
}
