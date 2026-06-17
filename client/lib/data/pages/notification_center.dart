/// The Notification Center page (Wave B) — the cyberpunk command center's
/// dashboard + notifications surface.
///
/// Authored under the COMPOSITE model: every visual CARD is a SINGLE composite
/// widget node that draws its OWN card chrome + all of its sub-content, so the
/// Designer treats one card as ONE entity. There are NO more `panel` +
/// decomposed clusters (gauge ring + stat rows, or panel + status rows, or
/// per-item notification nodes). Individual CONTROLS (media player, app
/// launchers, filter/action buttons) stay one node each — they are already
/// single entities.
///
/// The app shell supplies the header/clock/nav; this page is just the content,
/// composed on a 24×16 grid mirroring the reference:
///   * Media Player        — one `media.player` control (top-left)
///   * System Overview      — four `ring` COMPOSITE CARDS (CPU/GPU/RAM/Storage)
///   * Quick Launch         — a row of `launcher` controls
///   * System Status        — ONE `status.list` COMPOSITE CARD
///   * Notifications feed    — ONE `notification.list` COMPOSITE CARD, with the
///     filter chips + mark-all + history as individual button controls
///
/// Bound mock state ids (for Wave 2 to seed):
///   * `media`                 — Map{track,artist,playing,progress,elapsed,duration}
///   * `sys.cpu.temp`          — num °C (CPU overview ring)
///   * `sys.gpu.temp`          — num °C (GPU overview ring)
///   * `sys.ram`               — num % used (RAM overview ring)
///   * `sys.storage.used`      — num % used (Storage overview ring)
///   * `sys.power.plan`        — text (System Status row)
///   * `sys.network`           — text (System Status row)
///   * `sys.storage.free`      — text (System Status row)
///   * `sys.uptime`            — text (System Status row)
///
/// The NOTIFICATIONS feed rows are static mock content (no live bindings) —
/// authored inline as the `notification.list` card's items.
library;

import '../../render/model.dart';
import 'builders.dart';

// Prototype accents: CPU blue, GPU green, RAM purple, storage cyan, brand blue
// media, amber/red for alerts (matching the reference feed chips).
const String _kBlue = '#3B82F6';
const String _kGreen = '#10B981';
const String _kPurple = '#8B5CF6';
const String _kCyan = '#22D3EE';
const String _kAmber = '#F59E0B';
const String _kRed = '#EF4444';

/// Builds the Notification Center [LayoutPage]: a 24×16 grid where every card is
/// a self-contained composite node and controls are single nodes.
LayoutPage notificationCenterPage() {
  return LayoutPage(
    id: 'notification-center',
    grid: const GridConfig(columns: 24, rows: 16),
    widgets: [
      ..._mediaPlayer(),
      ..._systemOverview(),
      ..._quickLaunch(),
      ..._systemStatus(),
      ..._notificationsFeed(),
    ],
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MEDIA PLAYER — one `media.player` control (cols 0..7, rows 0..5). A section
// header labels it (a between-cards header, not a card).
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _mediaPlayer() {
  return [
    sectionHeader('notif.media.header',
        title: 'Media Player',
        placement: at(0, 0, colSpan: 8, rowSpan: 1)),
    mediaPlayer('notif.media.player',
        stateBinding: 'media',
        track: 'Blinding Lights',
        artist: 'The Weeknd',
        duration: 200,
        color: _kBlue,
        placement: at(0, 1, colSpan: 8, rowSpan: 5)),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// SYSTEM OVERVIEW — four `ring` COMPOSITE CARDS in a 2×2 grid (cols 8..15, rows
// 1..5). Each ring draws its OWN titled card chrome (no more panel + bare
// rings). A section header labels the cluster.
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _systemOverview() {
  return [
    sectionHeader('notif.overview.header',
        title: 'System Overview',
        placement: at(8, 0, colSpan: 8, rowSpan: 1)),
    ring('notif.overview.cpu',
        stateBinding: 'sys.cpu.temp',
        title: 'CPU',
        sublabel: 'CPU',
        unit: '°C',
        max: 100,
        color: _kBlue,
        valueRules: const [
          {'when': '>=85', 'style': {'theme': 'error'}},
          {'when': '>=70', 'style': {'theme': 'warn'}},
        ],
        placement: at(8, 1, colSpan: 4, rowSpan: 3)),
    ring('notif.overview.gpu',
        stateBinding: 'sys.gpu.temp',
        title: 'GPU',
        sublabel: 'GPU',
        unit: '°C',
        max: 100,
        color: _kGreen,
        valueRules: const [
          {'when': '>=90', 'style': {'theme': 'error'}},
          {'when': '>=78', 'style': {'theme': 'warn'}},
        ],
        placement: at(12, 1, colSpan: 4, rowSpan: 3)),
    ring('notif.overview.ram',
        stateBinding: 'sys.ram',
        title: 'RAM',
        sublabel: 'RAM',
        unit: '%',
        max: 100,
        color: _kPurple,
        valueRules: const [
          {'when': '>=90', 'style': {'theme': 'error'}},
          {'when': '>=75', 'style': {'theme': 'warn'}},
        ],
        placement: at(8, 4, colSpan: 4, rowSpan: 3)),
    ring('notif.overview.storage',
        stateBinding: 'sys.storage.used',
        title: 'Storage',
        sublabel: 'Storage',
        unit: '%',
        max: 100,
        color: _kCyan,
        valueRules: const [
          {'when': '>=95', 'style': {'theme': 'error'}},
          {'when': '>=85', 'style': {'theme': 'warn'}},
        ],
        placement: at(12, 4, colSpan: 4, rowSpan: 3)),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// QUICK LAUNCH — a row of `launcher` controls (cols 0..7, rows 7..9). Each
// launcher is a single control node; a section header labels the row.
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _quickLaunch() {
  return [
    sectionHeader('notif.quicklaunch.header',
        title: 'Quick Launch',
        placement: at(0, 6, colSpan: 8, rowSpan: 1)),
    launcher('notif.launch.discord',
        label: 'Discord',
        icon: 'app',
        action: 'launch.app',
        param: 'discord',
        color: _kPurple,
        placement: at(0, 7, colSpan: 2, rowSpan: 3)),
    launcher('notif.launch.spotify',
        label: 'Spotify',
        icon: 'play',
        action: 'launch.url',
        param: 'https://open.spotify.com',
        color: _kGreen,
        placement: at(2, 7, colSpan: 2, rowSpan: 3)),
    launcher('notif.launch.chrome',
        label: 'Chrome',
        icon: 'browser',
        action: 'launch.app',
        param: 'chrome',
        color: _kBlue,
        placement: at(4, 7, colSpan: 2, rowSpan: 3)),
    launcher('notif.launch.terminal',
        label: 'Terminal',
        icon: 'terminal',
        action: 'launch.app',
        param: 'wt.exe',
        color: _kCyan,
        placement: at(6, 7, colSpan: 2, rowSpan: 3)),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// SYSTEM STATUS — ONE `status.list` COMPOSITE CARD (cols 8..15, rows 7..15).
// Replaces the old panel + four bare stat rows; the card owns its chrome and
// renders the Power Plan / Network / Storage / Uptime rows itself.
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _systemStatus() {
  return [
    sectionHeader('notif.status.header',
        title: 'System Status',
        placement: at(8, 6, colSpan: 8, rowSpan: 1)),
    statusList('notif.status.list',
        placement: at(8, 7, colSpan: 8, rowSpan: 9),
        title: 'System Status',
        color: _kBlue,
        items: const [
          {'label': 'Power Plan', 'value': 'Balanced', 'icon': 'bolt', 'color': _kBlue},
          {'label': 'Network', 'value': 'Connected', 'icon': 'wifi', 'color': 'success'},
          {'label': 'Storage', 'value': '512 GB Free', 'icon': 'storage', 'color': _kCyan},
          {'label': 'Uptime', 'value': '02:45:33', 'icon': 'clock', 'color': _kPurple},
        ]),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS feed (right column, cols 16..23) — ONE `notification.list`
// COMPOSITE CARD owning the feed (title + scrollable rows + chrome). The
// mark-all / filter chips / history are individual button controls in their own
// cells around the card (not overlaid), each a single editor entity. NO panel +
// per-item nodes anymore.
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _notificationsFeed() {
  return [
    // The single feed card holds every notification row (cols 16..23, r 3..14).
    notificationList('notif.feed.list',
        placement: at(16, 3, colSpan: 8, rowSpan: 12),
        title: 'Notifications',
        color: _kPurple,
        items: const [
          {
            'title': 'Discord',
            'body': 'Alex sent a message in #stream-team',
            'time': '2m',
            'icon': 'app',
            'color': _kPurple,
          },
          {
            'title': 'Spotify',
            'body': 'Now playing: Blinding Lights — The Weeknd',
            'time': '5m',
            'icon': 'play',
            'color': _kGreen,
          },
          {
            'title': 'System Update',
            'body': 'Windows 11 update installed successfully',
            'time': '18m',
            'icon': 'check',
            'color': _kBlue,
          },
          {
            'title': 'StreamHub',
            'body': 'New donation from Aled — \$10',
            'time': '32m',
            'icon': 'star',
            'color': _kCyan,
          },
          {
            'title': 'Security Alert',
            'body': 'New login detected on Windows',
            'time': '1h',
            'icon': 'alert',
            'color': _kRed,
          },
          {
            'title': 'Hardware Monitor',
            'body': 'CPU temperature is above 80°C',
            'time': '2h',
            'icon': 'temp',
            'color': _kAmber,
          },
        ]),

    // Feed header: small-caps title + "6 NEW" count (a between-cards header).
    sectionHeader('notif.feed.header',
        title: 'Notifications',
        trailing: '6 NEW',
        color: _kPurple,
        placement: at(16, 0, colSpan: 5, rowSpan: 1)),
    // Header action: "Mark all as read" (top-right).
    iconButton('notif.feed.markall',
        icon: 'check',
        label: 'Mark all as read',
        action: 'notifications.markAllRead',
        color: _kPurple,
        placement: at(21, 0, colSpan: 3, rowSpan: 1)),

    // Filter chips: All / Apps / System / Alerts.
    iconButton('notif.filter.all',
        icon: 'info',
        label: 'All',
        action: 'notifications.filter.all',
        color: _kPurple,
        placement: at(16, 1, colSpan: 2, rowSpan: 1)),
    iconButton('notif.filter.apps',
        icon: 'app',
        label: 'Apps',
        action: 'notifications.filter.apps',
        color: _kBlue,
        placement: at(18, 1, colSpan: 2, rowSpan: 1)),
    iconButton('notif.filter.system',
        icon: 'settings',
        label: 'System',
        action: 'notifications.filter.system',
        color: _kCyan,
        placement: at(20, 1, colSpan: 2, rowSpan: 1)),
    iconButton('notif.filter.alerts',
        icon: 'alert',
        label: 'Alerts',
        action: 'notifications.filter.alerts',
        color: _kAmber,
        placement: at(22, 1, colSpan: 2, rowSpan: 1)),

    // Footer action: View Notification History.
    iconButton('notif.feed.history',
        icon: 'clock',
        label: 'View Notification History',
        action: 'notifications.history',
        color: _kPurple,
        placement: at(16, 15, colSpan: 8, rowSpan: 1)),
  ];
}
