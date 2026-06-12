/// Connection badge (PROJ-188). A reusable status pill mirroring the deck app-bar
/// badge: a coloured dot + label driven by the source's [ConnStatus]. It is the
/// always-visible signal that pairs with the degraded-deck dimming — green/"live"
/// when connected, amber/"connecting" mid-reconnect, red/"offline" when the link is
/// down (the deck is then dimmed over its last known values), cyan/"demo" offline.
///
/// Extracted so the same pill can be shown wherever degradation is surfaced without
/// duplicating the colour/label mapping.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../data/deck_source.dart';

/// Maps a [ConnStatus] to its badge colour + label.
(Color, String) connectionBadgeStyle(ConnStatus s) => switch (s) {
      ConnStatus.demo => (Colors.cyanAccent, 'demo'),
      ConnStatus.connecting => (Colors.amberAccent, 'connecting'),
      ConnStatus.connected => (Colors.greenAccent, 'live'),
      ConnStatus.disconnected => (Colors.redAccent, 'offline'),
    };

/// A reactive connection status pill: a coloured dot + label.
class ConnectionBadge extends StatelessWidget {
  const ConnectionBadge(this.status, {super.key});

  /// Reactive connection status (the source's badge stream).
  final ValueListenable<ConnStatus> status;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Center(
        child: ValueListenableBuilder<ConnStatus>(
          valueListenable: status,
          builder: (context, s, _) {
            final (color, text) = connectionBadgeStyle(s);
            return Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.circle, size: 11, color: color),
              const SizedBox(width: 6),
              Text(text, key: const Key('deck-conn-badge')),
            ]);
          },
        ),
      ),
    );
  }
}

/// Whether a connection status means the live link is down — i.e. the deck should
/// render degraded (dimmed, last-known values). Demo Mode is offline-by-design and
/// is NOT degraded; only a dropped live link degrades the deck.
bool isDegradedStatus(ConnStatus s) => s == ConnStatus.disconnected;
