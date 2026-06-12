/// Degradation rendering (PROJ-188, 2C §7.3 / NFR-08). When the live link drops,
/// the deck does NOT freeze and NEVER fabricates data: every bound widget keeps
/// rendering its LAST received value (held by the [ClientStateStore]) but the whole
/// surface is DIMMED so the operator can tell at a glance the values are stale, and
/// a "link lost" banner is shown. Capabilities that were never received read null —
/// which the widgets already format as "--" — so an unavailable capability shows
/// "--" rather than a lie. On reconnect the interpreter clears degradation and the
/// surface returns to full brightness with live values.
///
/// This is a pure presentation wrapper: it touches no state values, so it cannot
/// freeze or fabricate live data. The interpreter owns the [degraded] flag and the
/// deck screen drives it from the connection status.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Opacity applied to the deck surface while degraded (stale-but-readable).
const double kDegradedOpacity = 0.45;

/// Dims [child] and overlays a stale-link banner while [degraded] is true; renders
/// [child] untouched otherwise. The dim is a single [Opacity] over the whole deck so
/// individual widgets stay pixel-identical (just faded) — no per-widget rework, and
/// no value is ever changed.
class DegradationOverlay extends StatelessWidget {
  const DegradationOverlay({
    super.key,
    required this.degraded,
    required this.child,
    this.message = 'Link lost — showing last known values',
  });

  /// Reactive degradation flag (the interpreter's `degraded`).
  final ValueListenable<bool> degraded;

  /// The live deck surface.
  final Widget child;

  /// Banner copy shown across the top while degraded.
  final String message;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: degraded,
      builder: (context, isDegraded, _) {
        if (!isDegraded) return child;
        return Stack(
          key: const Key('degradation-overlay'),
          children: [
            // The deck itself: untouched values, just faded so staleness reads.
            Opacity(opacity: kDegradedOpacity, child: child),
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: _StaleBanner(message: message),
            ),
          ],
        );
      },
    );
  }
}

/// The thin "stale data" banner pinned to the top of a degraded deck.
class _StaleBanner extends StatelessWidget {
  const _StaleBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        key: const Key('degradation-banner'),
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
        color: Colors.redAccent.withValues(alpha: 0.16),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 13, color: Colors.redAccent),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                message,
                style: const TextStyle(fontSize: 11, color: Colors.redAccent),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
