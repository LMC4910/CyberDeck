/// The Dashboard page (Wave 1) — the CyberDeck "Control Center" home, authored as
/// a data-driven [LayoutPage] on a 24×16 grid. It mirrors `prototype.html` /
/// `Reference Images/home.png` under the GRANULARITY MODEL: every visual "card" is
/// a glass [panel] placed FIRST (so the interpreter paints it BEHIND) with small
/// BARE widgets (launchers, control tiles, gauge rings, stat rows, sparklines,
/// labels) layered ON TOP — each individually Designer-editable.
///
/// The app shell supplies the header/clock/nav; this page is just the content.
///
/// Bound mock state ids (for Wave 2 to seed):
///   * `media`            — Map{track,artist,playing,progress,elapsed,duration}
///   * `media.volume`     — num 0..100 (the vertical volume slider)
///   * `media.playing`    — bool (freezes the right-hand visualizer when false)
///   * `media.muted`      — bool (the Mute control tile active state)
///   * `sys.cpu.temp`     — num °C (CPU gauge + its sparkline trend)
///   * `sys.cpu.temp.min` / `.max` / `.avg` — num °C (CPU stat rows)
///   * `sys.gpu.temp`     — num °C (GPU gauge + its sparkline trend)
///   * `sys.gpu.temp.min` / `.max` / `.avg` — num °C (GPU stat rows)
///   * `sys.ram`          — num % used (RAM gauge + its sparkline trend)
///   * `sys.ram.used` / `.free` / `.total` — text GB (RAM stat rows)
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

/// Builds the Dashboard [LayoutPage]: a 24×16 grid composed under the granularity
/// model (panels behind, bare widgets in front).
LayoutPage dashboardPage() {
  final widgets = <WidgetNode>[
    // ── Quick Launch ──────────────────────────────────────────────────────────
    // Section header above the launcher row (left 18 cols = the prototype's 75%).
    sectionHeader('dash.quicklaunch.header',
        title: 'Quick Launch', placement: at(0, 0, colSpan: 18, rowSpan: 1)),
    // Five app launchers, each 3 cols wide, 3 rows tall.
    launcher('dash.launch.disney',
        label: 'Disney+',
        icon: 'star',
        action: 'app.launch.disney',
        color: _kBlue,
        placement: at(0, 1, colSpan: 3, rowSpan: 3)),
    launcher('dash.launch.prime',
        label: 'Prime Video',
        icon: 'play',
        action: 'app.launch.prime',
        color: '#22D3EE',
        placement: at(3, 1, colSpan: 3, rowSpan: 3)),
    launcher('dash.launch.netflix',
        label: 'Netflix',
        action: 'app.launch.netflix',
        color: '#E50914',
        placement: at(6, 1, colSpan: 3, rowSpan: 3)),
    launcher('dash.launch.chrome',
        label: 'Chrome',
        icon: 'browser',
        action: 'app.launch.chrome',
        color: _kGreen,
        placement: at(9, 1, colSpan: 3, rowSpan: 3)),
    launcher('dash.launch.chatgpt',
        label: 'ChatGPT',
        icon: 'bolt',
        action: 'app.launch.chatgpt',
        color: '#10A37F',
        placement: at(12, 1, colSpan: 3, rowSpan: 3)),

    // ── Control band: left tiles · media player · right tiles ─────────────────
    // Left 2×2 control tiles (Pause / Previous / Lock System / Terminal).
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
        action: 'app.launch.terminal',
        placement: at(2, 6, colSpan: 2, rowSpan: 2)),

    // Center media player (spans the middle of the band, 8 cols × 4 rows).
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
        action: 'media.volume.mute',
        placement: at(16, 4, colSpan: 2, rowSpan: 2)),
    controlTile('dash.ctl.files',
        label: 'File Explorer',
        icon: 'folder',
        action: 'app.launch.files',
        placement: at(14, 6, colSpan: 2, rowSpan: 2)),
    controlTile('dash.ctl.controlpanel',
        label: 'Control Panel',
        icon: 'settings',
        action: 'app.launch.controlpanel',
        placement: at(16, 6, colSpan: 2, rowSpan: 2)),

    // ── Right column: Volume slider panel + Visualizer panel ──────────────────
    // Volume panel (behind) + vertical volume slider (in front).
    panel('dash.volume.panel',
        title: 'Volume',
        accent: _kPurple,
        placement: at(18, 0, colSpan: 6, rowSpan: 5)),
    slider('dash.volume.slider',
        stateBinding: 'media.volume',
        vertical: true,
        action: 'media.volume.set',
        color: _kPurple,
        placement: at(19, 1, colSpan: 4, rowSpan: 3)),

    // Visualizer panel (behind) + bare visualizer bars (in front).
    panel('dash.visualizer.panel',
        accent: _kBlue, placement: at(18, 5, colSpan: 6, rowSpan: 3)),
    visualizer('dash.visualizer.bars',
        stateBinding: 'media.playing',
        bars: 9,
        color: _kBlue,
        placement: at(19, 6, colSpan: 4, rowSpan: 1)),

    // ── Bottom monitoring row ─────────────────────────────────────────────────
    sectionHeader('dash.monitor.header',
        title: 'System Monitor', placement: at(0, 8, colSpan: 18, rowSpan: 1)),

    // CPU TEMPERATURE: panel + ring + Min/Max/Avg stat rows + sparkline.
    panel('dash.cpu.panel',
        title: 'CPU Temperature',
        accent: _kBlue,
        placement: at(0, 9, colSpan: 6, rowSpan: 7)),
    gaugeCircular('dash.cpu.gauge',
        stateBinding: 'sys.cpu.temp',
        sublabel: 'Normal',
        unit: '°C',
        max: 100,
        color: _kBlue,
        valueRules: [
          {'when': '>=85', 'style': {'theme': 'error'}},
          {'when': '>=70', 'style': {'theme': 'warn'}},
        ],
        placement: at(1, 10, colSpan: 3, rowSpan: 3)),
    statRow('dash.cpu.min',
        label: 'Min',
        stateBinding: 'sys.cpu.temp.min',
        unit: '°C',
        placement: at(4, 10, colSpan: 2, rowSpan: 1)),
    statRow('dash.cpu.max',
        label: 'Max',
        stateBinding: 'sys.cpu.temp.max',
        unit: '°C',
        placement: at(4, 11, colSpan: 2, rowSpan: 1)),
    statRow('dash.cpu.avg',
        label: 'Avg',
        stateBinding: 'sys.cpu.temp.avg',
        unit: '°C',
        placement: at(4, 12, colSpan: 2, rowSpan: 1)),
    sparkline('dash.cpu.spark',
        stateBinding: 'sys.cpu.temp',
        color: _kBlue,
        placement: at(1, 13, colSpan: 4, rowSpan: 2)),

    // GPU TEMPERATURE.
    panel('dash.gpu.panel',
        title: 'GPU Temperature',
        accent: _kGreen,
        placement: at(6, 9, colSpan: 6, rowSpan: 7)),
    gaugeCircular('dash.gpu.gauge',
        stateBinding: 'sys.gpu.temp',
        sublabel: 'Normal',
        unit: '°C',
        max: 100,
        color: _kGreen,
        valueRules: [
          {'when': '>=90', 'style': {'theme': 'error'}},
          {'when': '>=78', 'style': {'theme': 'warn'}},
        ],
        placement: at(7, 10, colSpan: 3, rowSpan: 3)),
    statRow('dash.gpu.min',
        label: 'Min',
        stateBinding: 'sys.gpu.temp.min',
        unit: '°C',
        placement: at(10, 10, colSpan: 2, rowSpan: 1)),
    statRow('dash.gpu.max',
        label: 'Max',
        stateBinding: 'sys.gpu.temp.max',
        unit: '°C',
        placement: at(10, 11, colSpan: 2, rowSpan: 1)),
    statRow('dash.gpu.avg',
        label: 'Avg',
        stateBinding: 'sys.gpu.temp.avg',
        unit: '°C',
        placement: at(10, 12, colSpan: 2, rowSpan: 1)),
    sparkline('dash.gpu.spark',
        stateBinding: 'sys.gpu.temp',
        color: _kGreen,
        placement: at(7, 13, colSpan: 4, rowSpan: 2)),

    // RAM USAGE.
    panel('dash.ram.panel',
        title: 'RAM Usage',
        accent: _kPurple,
        placement: at(12, 9, colSpan: 6, rowSpan: 7)),
    gaugeCircular('dash.ram.gauge',
        stateBinding: 'sys.ram',
        sublabel: 'Used',
        unit: '%',
        max: 100,
        color: _kPurple,
        valueRules: [
          {'when': '>=90', 'style': {'theme': 'error'}},
          {'when': '>=75', 'style': {'theme': 'warn'}},
        ],
        placement: at(13, 10, colSpan: 3, rowSpan: 3)),
    statRow('dash.ram.used',
        label: 'Used',
        stateBinding: 'sys.ram.used',
        placement: at(16, 10, colSpan: 2, rowSpan: 1)),
    statRow('dash.ram.free',
        label: 'Free',
        stateBinding: 'sys.ram.free',
        placement: at(16, 11, colSpan: 2, rowSpan: 1)),
    statRow('dash.ram.total',
        label: 'Total',
        stateBinding: 'sys.ram.total',
        placement: at(16, 12, colSpan: 2, rowSpan: 1)),
    sparkline('dash.ram.spark',
        stateBinding: 'sys.ram',
        color: _kPurple,
        placement: at(13, 13, colSpan: 4, rowSpan: 2)),

    // ── System Status (right column) ──────────────────────────────────────────
    sectionHeader('dash.status.header',
        title: 'System Status', placement: at(18, 8, colSpan: 6, rowSpan: 1)),
    panel('dash.status.panel',
        accent: _kBlue, placement: at(18, 9, colSpan: 6, rowSpan: 7)),
    statRow('dash.status.power',
        label: 'Power Plan',
        stateBinding: 'sys.power.plan',
        value: 'Balanced',
        placement: at(19, 10, colSpan: 4, rowSpan: 1)),
    statRow('dash.status.network',
        label: 'Network',
        stateBinding: 'sys.network',
        value: 'Connected',
        color: 'success',
        placement: at(19, 11, colSpan: 4, rowSpan: 1)),
    statRow('dash.status.storage',
        label: 'Storage',
        stateBinding: 'sys.storage.free',
        value: '512 GB Free',
        placement: at(19, 12, colSpan: 4, rowSpan: 1)),
    statRow('dash.status.uptime',
        label: 'Uptime',
        stateBinding: 'sys.uptime',
        value: '02:45:33',
        placement: at(19, 13, colSpan: 4, rowSpan: 1)),
  ];

  return LayoutPage(
    id: 'dashboard',
    grid: const GridConfig(columns: 24, rows: 16),
    widgets: widgets,
  );
}
