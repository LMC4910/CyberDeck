/// The Notification Center page (Wave 1) — authored as a data-driven [LayoutPage]
/// on a 24×16 grid. It mirrors the reference (a dashboard-style left column +
/// a right-hand NOTIFICATIONS feed) under the GRANULARITY MODEL: every visual
/// "card" is a glass [panel] placed FIRST (so the interpreter paints it BEHIND)
/// with small BARE widgets (media player, gauge rings, launchers, stat rows,
/// filter chips, notification rows, action buttons) layered ON TOP — each one
/// individually Designer-editable.
///
/// The app shell supplies the header/clock/nav; this page is just the content.
///
/// Bound mock state ids (for Wave 2 to seed):
///   * `media`                 — Map{track,artist,playing,progress,elapsed,duration}
///   * `media.volume`          — num 0..100 (not used here; shared id reserved)
///   * `sys.cpu.temp`          — num °C (CPU overview ring)
///   * `sys.gpu.temp`          — num °C (GPU overview ring)
///   * `sys.ram`               — num % used (RAM overview ring)
///   * `sys.storage.used`      — num % used (Storage overview ring)
///   * `sys.power.plan`        — text (System Status row)
///   * `sys.network`           — text (System Status row)
///   * `sys.storage.free`      — text (System Status row)
///   * `sys.uptime`            — text (System Status row)
///
/// The NOTIFICATIONS feed rows are static mock content (no live bindings) — the
/// "6 NEW" count + filter chips + per-item title/body/time are authored inline so
/// Wave 2 only needs to seed the dashboard `media`/`sys.*` ids above.
library;

import '../../render/model.dart';
import 'builders.dart';

// Prototype accents: CPU blue, GPU green, RAM purple, brand blue media,
// amber/red for alerts (matching the reference feed chips).
const String _kBlue = '#3B82F6';
const String _kGreen = '#10B981';
const String _kPurple = '#8B5CF6';
const String _kCyan = '#22D3EE';
const String _kAmber = '#F59E0B';
const String _kRed = '#EF4444';

/// Builds the Notification Center [LayoutPage]: a 24×16 grid composed under the
/// granularity model (panels behind, bare widgets in front).
LayoutPage notificationCenterPage() {
  final widgets = <WidgetNode>[
    // ── Media Player (top-left) ───────────────────────────────────────────────
    sectionHeader('notif.media.header',
        title: 'Media Player', placement: at(0, 0, colSpan: 8, rowSpan: 1)),
    mediaPlayer('notif.media.player',
        stateBinding: 'media',
        track: 'Blinding Lights',
        artist: 'The Weeknd',
        duration: 200,
        color: _kBlue,
        placement: at(0, 1, colSpan: 8, rowSpan: 5)),

    // ── System Overview (top-mid): four gauge rings on one glass panel ────────
    sectionHeader('notif.overview.header',
        title: 'System Overview', placement: at(8, 0, colSpan: 8, rowSpan: 1)),
    panel('notif.overview.panel',
        accent: _kBlue, placement: at(8, 1, colSpan: 8, rowSpan: 5)),
    ring('notif.overview.cpu',
        stateBinding: 'sys.cpu.temp',
        sublabel: 'CPU',
        unit: '°C',
        max: 100,
        color: _kBlue,
        valueRules: [
          {'when': '>=85', 'style': {'theme': 'error'}},
          {'when': '>=70', 'style': {'theme': 'warn'}},
        ],
        placement: at(8, 2, colSpan: 4, rowSpan: 2)),
    ring('notif.overview.gpu',
        stateBinding: 'sys.gpu.temp',
        sublabel: 'GPU',
        unit: '°C',
        max: 100,
        color: _kGreen,
        valueRules: [
          {'when': '>=90', 'style': {'theme': 'error'}},
          {'when': '>=78', 'style': {'theme': 'warn'}},
        ],
        placement: at(12, 2, colSpan: 4, rowSpan: 2)),
    ring('notif.overview.ram',
        stateBinding: 'sys.ram',
        sublabel: 'RAM',
        unit: '%',
        max: 100,
        color: _kPurple,
        valueRules: [
          {'when': '>=90', 'style': {'theme': 'error'}},
          {'when': '>=75', 'style': {'theme': 'warn'}},
        ],
        placement: at(8, 4, colSpan: 4, rowSpan: 2)),
    ring('notif.overview.storage',
        stateBinding: 'sys.storage.used',
        sublabel: 'Storage',
        unit: '%',
        max: 100,
        color: _kCyan,
        valueRules: [
          {'when': '>=95', 'style': {'theme': 'error'}},
          {'when': '>=85', 'style': {'theme': 'warn'}},
        ],
        placement: at(12, 4, colSpan: 4, rowSpan: 2)),

    // ── Quick Launch (bottom-left) ────────────────────────────────────────────
    sectionHeader('notif.quicklaunch.header',
        title: 'Quick Launch', placement: at(0, 6, colSpan: 8, rowSpan: 1)),
    launcher('notif.launch.discord',
        label: 'Discord',
        icon: 'app',
        action: 'app.launch.discord',
        color: _kPurple,
        placement: at(0, 7, colSpan: 2, rowSpan: 3)),
    launcher('notif.launch.spotify',
        label: 'Spotify',
        icon: 'play',
        action: 'app.launch.spotify',
        color: _kGreen,
        placement: at(2, 7, colSpan: 2, rowSpan: 3)),
    launcher('notif.launch.chrome',
        label: 'Chrome',
        icon: 'browser',
        action: 'app.launch.chrome',
        color: _kBlue,
        placement: at(4, 7, colSpan: 2, rowSpan: 3)),
    launcher('notif.launch.terminal',
        label: 'Terminal',
        icon: 'terminal',
        action: 'app.launch.terminal',
        color: _kCyan,
        placement: at(6, 7, colSpan: 2, rowSpan: 3)),

    // ── System Status (bottom-mid) ────────────────────────────────────────────
    sectionHeader('notif.status.header',
        title: 'System Status', placement: at(8, 6, colSpan: 8, rowSpan: 1)),
    panel('notif.status.panel',
        accent: _kBlue, placement: at(8, 7, colSpan: 8, rowSpan: 9)),
    statRow('notif.status.power',
        label: 'Power Plan',
        stateBinding: 'sys.power.plan',
        value: 'Balanced',
        placement: at(9, 8, colSpan: 6, rowSpan: 1)),
    statRow('notif.status.network',
        label: 'Network',
        stateBinding: 'sys.network',
        value: 'Connected',
        color: 'success',
        placement: at(9, 10, colSpan: 6, rowSpan: 1)),
    statRow('notif.status.storage',
        label: 'Storage',
        stateBinding: 'sys.storage.free',
        value: '512 GB Free',
        placement: at(9, 12, colSpan: 6, rowSpan: 1)),
    statRow('notif.status.uptime',
        label: 'Uptime',
        stateBinding: 'sys.uptime',
        value: '02:45:33',
        placement: at(9, 14, colSpan: 6, rowSpan: 1)),

    // ── NOTIFICATIONS feed (right column, cols 16..23) ────────────────────────
    // Panel placed FIRST so it paints behind the whole feed stack.
    panel('notif.feed.panel',
        title: 'Notifications',
        accent: _kPurple,
        placement: at(16, 0, colSpan: 8, rowSpan: 16)),

    // Header row: title (via panel) + "Mark all as read" action top-right.
    sectionHeader('notif.feed.header',
        title: 'Notifications',
        trailing: '6 NEW',
        color: _kPurple,
        placement: at(17, 0, colSpan: 4, rowSpan: 1)),
    iconButton('notif.feed.markall',
        icon: 'check',
        label: 'Mark all as read',
        action: 'notifications.markAllRead',
        color: _kPurple,
        placement: at(20, 0, colSpan: 3, rowSpan: 1)),

    // Filter chips: All / Apps / System / Alerts.
    iconButton('notif.filter.all',
        icon: 'info',
        label: 'All',
        action: 'notifications.filter.all',
        color: _kPurple,
        placement: at(17, 1, colSpan: 2, rowSpan: 1)),
    iconButton('notif.filter.apps',
        icon: 'app',
        label: 'Apps',
        action: 'notifications.filter.apps',
        color: _kBlue,
        placement: at(19, 1, colSpan: 2, rowSpan: 1)),
    iconButton('notif.filter.system',
        icon: 'settings',
        label: 'System',
        action: 'notifications.filter.system',
        color: _kCyan,
        placement: at(21, 1, colSpan: 2, rowSpan: 1)),
    iconButton('notif.filter.alerts',
        icon: 'alert',
        label: 'Alerts',
        action: 'notifications.filter.alerts',
        color: _kAmber,
        placement: at(17, 2, colSpan: 2, rowSpan: 1)),

    // The scrollable column of notification.item rows (each individually editable).
    notificationItem('notif.item.discord',
        title: 'Discord',
        body: 'Alex sent a message in #stream-team',
        time: '2m',
        icon: 'app',
        color: _kPurple,
        placement: at(17, 3, colSpan: 6, rowSpan: 2)),
    notificationItem('notif.item.spotify',
        title: 'Spotify',
        body: 'Now playing: Blinding Lights — The Weeknd',
        time: '5m',
        icon: 'play',
        color: _kGreen,
        placement: at(17, 5, colSpan: 6, rowSpan: 2)),
    notificationItem('notif.item.update',
        title: 'System Update',
        body: 'Windows 11 update installed successfully',
        time: '18m',
        icon: 'check',
        color: _kBlue,
        placement: at(17, 7, colSpan: 6, rowSpan: 2)),
    notificationItem('notif.item.streamhub',
        title: 'StreamHub',
        body: 'New donation from Aled — \$10',
        time: '32m',
        icon: 'star',
        color: _kCyan,
        placement: at(17, 9, colSpan: 6, rowSpan: 2)),
    notificationItem('notif.item.security',
        title: 'Security Alert',
        body: 'New login detected on Windows',
        time: '1h',
        icon: 'alert',
        color: _kRed,
        placement: at(17, 11, colSpan: 6, rowSpan: 2)),
    notificationItem('notif.item.hardware',
        title: 'Hardware Monitor',
        body: 'CPU temperature is above 80°C',
        time: '2h',
        icon: 'temp',
        color: _kAmber,
        placement: at(17, 13, colSpan: 6, rowSpan: 2)),

    // Footer action: View Notification History.
    iconButton('notif.feed.history',
        icon: 'clock',
        label: 'View Notification History',
        action: 'notifications.history',
        color: _kPurple,
        placement: at(17, 15, colSpan: 6, rowSpan: 1)),
  ];

  return LayoutPage(
    id: 'notification-center',
    grid: const GridConfig(columns: 24, rows: 16),
    widgets: widgets,
  );
}
