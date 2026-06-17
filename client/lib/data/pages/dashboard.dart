/// The Dashboard page (Wave 1) — the CyberDeck "Control Center" home, authored as
/// a data-driven [LayoutPage] on a 24×16 grid. It mirrors `prototype.html` /
/// `Reference Images/home.png` under the COMPOSITE-CARD model: every visual "card"
/// is a SINGLE composite node that draws its OWN card chrome + all sub-content, so
/// the Designer treats each card as one entity. Individual controls (launchers,
/// control tiles, the media player) stay single nodes — they already are one
/// entity each.
///
/// The app shell supplies the header/clock/nav; this page is just the content.
///
/// Bound mock state ids (for Wave 2 to seed):
///   * `media`            — Map{track,artist,playing,progress,elapsed,duration}
///   * `media.volume`     — num 0..100 (the vertical volume slider card)
///   * `media.playing`    — bool (freezes the right-hand visualizer when false)
///   * `sys.cpu.temp`     — num °C (CPU gauge value; its Min/Max/Avg + trend come
///                          from the card's own `history`)
///   * `sys.gpu.temp`     — num °C (GPU gauge value)
///   * `sys.ram`          — num % used (RAM gauge value)
///   * `sys.power.plan`   — text (System Status)
///   * `sys.network`      — text (System Status)
///   * `sys.storage.free` — text (System Status)
///   * `sys.uptime`       — text (System Status)
library;

import '../../render/model.dart';
import 'builders.dart';

// Prototype accents (home.png): CPU blue, GPU green, RAM purple, brand blue media.
const String _kBlue = '#3B82F6';
const String _kGreen = '#10B981';
const String _kPurple = '#8B5CF6';

/// Builds the Dashboard [LayoutPage]: a 24×16 grid of single composite cards plus
/// the individual control widgets (launchers, control tiles, media player).
LayoutPage dashboardPage() {
  final widgets = <WidgetNode>[
    // ── Quick Launch ──────────────────────────────────────────────────────────
    // Section header above the launcher row (left 18 cols = the prototype's 75%).
    sectionHeader('dash.quicklaunch.header',
        title: 'Quick Launch', placement: at(0, 0, colSpan: 18, rowSpan: 1)),
    // Five app launchers, each 3 cols wide, 3 rows tall — individual controls.
    launcher('dash.launch.disney',
        label: 'Disney+',
        icon: 'star',
        action: 'launch.url',
        param: 'https://www.disneyplus.com',
        color: _kBlue,
        placement: at(0, 1, colSpan: 3, rowSpan: 3)),
    launcher('dash.launch.prime',
        label: 'Prime Video',
        icon: 'play',
        action: 'launch.url',
        param: 'https://www.primevideo.com',
        color: '#22D3EE',
        placement: at(3, 1, colSpan: 3, rowSpan: 3)),
    launcher('dash.launch.netflix',
        label: 'Netflix',
        action: 'launch.url',
        param: 'https://www.netflix.com',
        color: '#E50914',
        placement: at(6, 1, colSpan: 3, rowSpan: 3)),
    launcher('dash.launch.chrome',
        label: 'Chrome',
        icon: 'browser',
        action: 'launch.app',
        param: 'chrome',
        color: _kGreen,
        placement: at(9, 1, colSpan: 3, rowSpan: 3)),
    launcher('dash.launch.chatgpt',
        label: 'ChatGPT',
        icon: 'bolt',
        action: 'launch.url',
        param: 'https://chatgpt.com',
        color: '#10A37F',
        placement: at(12, 1, colSpan: 3, rowSpan: 3)),

    // ── Control band: left tiles · media player · right tiles ─────────────────
    // Left 2×2 control tiles (Pause / Previous / Lock System / Terminal) — each a
    // single control node.
    controlTile('dash.ctl.pause',
        label: 'Pause',
        icon: 'pause',
        action: 'media.transport.pause',
        placement: at(0, 4, colSpan: 2, rowSpan: 2)),
    controlTile('dash.ctl.previous',
        label: 'Previous',
        icon: 'previous',
        action: 'media.transport.previous',
        placement: at(2, 4, colSpan: 2, rowSpan: 2)),
    controlTile('dash.ctl.lock',
        label: 'Lock System',
        icon: 'power',
        action: 'system.lock',
        confirm: true,
        placement: at(0, 6, colSpan: 2, rowSpan: 2)),
    controlTile('dash.ctl.terminal',
        label: 'Terminal',
        icon: 'terminal',
        action: 'launch.app',
        param: 'wt.exe',
        placement: at(2, 6, colSpan: 2, rowSpan: 2)),

    // Center media player (one composite control node, 9 cols × 4 rows).
    mediaPlayer('dash.media.player',
        stateBinding: 'media',
        track: 'Blinding Lights',
        artist: 'The Weeknd',
        duration: 200,
        color: _kBlue,
        placement: at(5, 4, colSpan: 9, rowSpan: 4)),

    // Right 2×2 control tiles (Next / Mute / File Explorer / Control Panel).
    controlTile('dash.ctl.next',
        label: 'Next',
        icon: 'next',
        action: 'media.transport.next',
        placement: at(14, 4, colSpan: 2, rowSpan: 2)),
    controlTile('dash.ctl.mute',
        label: 'Mute',
        icon: 'mute',
        action: 'volume.mute',
        placement: at(16, 4, colSpan: 2, rowSpan: 2)),
    controlTile('dash.ctl.files',
        label: 'File Explorer',
        icon: 'folder',
        action: 'launch.app',
        param: 'explorer.exe',
        placement: at(14, 6, colSpan: 2, rowSpan: 2)),
    controlTile('dash.ctl.controlpanel',
        label: 'Control Panel',
        icon: 'settings',
        action: 'launch.app',
        param: 'control.exe',
        placement: at(16, 6, colSpan: 2, rowSpan: 2)),

    // ── Right column: Volume card + Visualizer card (each ONE composite node) ──
    // Volume = a single vertical-slider composite card (its own titled chrome).
    slider('dash.volume.card',
        stateBinding: 'media.volume',
        vertical: true,
        title: 'Volume',
        action: 'volume.set',
        color: _kPurple,
        placement: at(18, 0, colSpan: 6, rowSpan: 5)),

    // Visualizer = a single composite card (its own chrome around the bars).
    visualizer('dash.visualizer.card',
        stateBinding: 'media.playing',
        bars: 9,
        color: _kBlue,
        card: true,
        placement: at(18, 5, colSpan: 6, rowSpan: 3)),

    // ── Bottom monitoring row — 3 gauge COMPOSITE cards ───────────────────────
    sectionHeader('dash.monitor.header',
        title: 'System Monitor', placement: at(0, 8, colSpan: 18, rowSpan: 1)),

    // CPU TEMPERATURE: one composite card (own chrome + ring + Min/Max/Avg from
    // its history + inline sparkline). No panel, no decomposed parts.
    gaugeCircular('dash.cpu.card',
        title: 'CPU Temperature',
        stateBinding: 'sys.cpu.temp',
        sublabel: 'Normal',
        unit: '°C',
        max: 100,
        color: _kBlue,
        history: const [35, 41, 38, 45, 42, 48, 44, 47, 42],
        valueRules: [
          {'when': '>=85', 'style': {'theme': 'error'}},
          {'when': '>=70', 'style': {'theme': 'warn'}},
        ],
        placement: at(0, 9, colSpan: 6, rowSpan: 7)),

    // GPU TEMPERATURE: one composite card.
    gaugeCircular('dash.gpu.card',
        title: 'GPU Temperature',
        stateBinding: 'sys.gpu.temp',
        sublabel: 'Normal',
        unit: '°C',
        max: 100,
        color: _kGreen,
        history: const [40, 52, 48, 58, 55, 62, 56, 60, 55],
        valueRules: [
          {'when': '>=90', 'style': {'theme': 'error'}},
          {'when': '>=78', 'style': {'theme': 'warn'}},
        ],
        placement: at(6, 9, colSpan: 6, rowSpan: 7)),

    // RAM USAGE: one composite card.
    gaugeCircular('dash.ram.card',
        title: 'RAM Usage',
        stateBinding: 'sys.ram',
        sublabel: 'Used',
        unit: '%',
        max: 100,
        color: _kPurple,
        history: const [58, 61, 60, 66, 64, 70, 63, 67, 64],
        valueRules: [
          {'when': '>=90', 'style': {'theme': 'error'}},
          {'when': '>=75', 'style': {'theme': 'warn'}},
        ],
        placement: at(12, 9, colSpan: 6, rowSpan: 7)),

    // ── System Status (right column) — one composite status-list card ─────────
    sectionHeader('dash.status.header',
        title: 'System Status', placement: at(18, 8, colSpan: 6, rowSpan: 1)),
    statusList('dash.status.card',
        color: _kBlue,
        items: const [
          {'icon': 'bolt', 'label': 'Power Plan', 'value': 'Balanced'},
          {
            'icon': 'wifi',
            'label': 'Network',
            'value': 'Connected',
            'color': 'success',
          },
          {'icon': 'storage', 'label': 'Storage', 'value': '512 GB Free'},
          {'icon': 'clock', 'label': 'Uptime', 'value': '02:45:33'},
        ],
        placement: at(18, 9, colSpan: 6, rowSpan: 7)),
  ];

  return LayoutPage(
    id: 'dashboard',
    grid: const GridConfig(columns: 24, rows: 16),
    widgets: widgets,
  );
}
