/// Seed/demo decks for Demo Mode — the seven authored CyberDeck pages registered
/// as openable decks, plus the initial mock state every page binds. Each page is a
/// data-driven [LayoutPage] (render/model.dart) built by its page function under
/// `data/pages/`, so the renderer is exercised exactly as it would be against a
/// live engine.
///
/// Wave 2 integration responsibilities handled here:
///   * register all 7 pages with stable deck ids (`dashboard` first);
///   * normalize each page's interaction slots so taps actually dispatch — the
///     Wave 0 builders author `interaction.tap = {action, confirm?}`, while the
///     gesture seam (gestures/slots.dart) resolves `{target:'action', ref}` and the
///     2-tap confirm reads `config.confirm`. [_wirePage] bridges the two shapes
///     WITHOUT touching the page authors or the gesture/builder layers;
///   * seed every bound state id the pages read (see [seedInitialState]).
library;

import '../render/model.dart';
import 'deck_source.dart';
import 'pages/dashboard.dart';
import 'pages/gaming_hub.dart';
import 'pages/media_center.dart';
import 'pages/notification_center.dart';
import 'pages/smart_home.dart';
import 'pages/system_control.dart';
import 'pages/system_overview.dart';

/// A seed deck = its summary (for the deck list) + its layout page (for the renderer).
class SeedDeck {
  const SeedDeck(this.summary, this.page);
  final DeckSummary summary;
  final LayoutPage page;
}

/// The demo decks shown in Demo Mode, in nav order. `dashboard` is first (the rich
/// Control-Center home the Dashboard nav resolves to). Deck ids are stable so the
/// shell nav + tests can address them.
List<SeedDeck> seedDecks() => [
      _deck('dashboard', 'Dashboard',
          'Quick launch · media · system monitor', dashboardPage()),
      _deck('system-control', 'System Control',
          'Power · performance · fans · storage', systemControlPage()),
      _deck('media', 'Media', 'Now playing · audio mixer · weather',
          mediaCenterPage()),
      _deck('gaming', 'Gaming Hub',
          'Library · live metrics · optimization', gamingHubPage()),
      _deck('smart-home', 'Smart Home',
          'Rooms · devices · scenes · energy', smartHomePage()),
      _deck('overview', 'System Overview',
          'Vitals · performance history · processes', systemOverviewPage()),
      _deck('notifications', 'Notifications',
          'Live feed · now playing · system', notificationCenterPage()),
    ];

/// Builds a [SeedDeck], pinning the deck id onto the page and wiring its
/// interaction slots so taps/drags dispatch under the live gesture seam.
SeedDeck _deck(String id, String title, String subtitle, LayoutPage page) =>
    SeedDeck(
      DeckSummary(id: id, title: title, subtitle: subtitle),
      _wirePage(id, page),
    );

// ---------------------------------------------------------------------------
// Deck id pinning
// ---------------------------------------------------------------------------

/// Pins the deck id onto the page so the deck id stays authoritative regardless
/// of the page function's own id. No interaction rewriting: the gesture seam
/// (`InteractionTarget.fromMap`) reads the builders' `{action, confirm?}` shape
/// natively, so Demo Mode, the live engine, and Designer-edited decks all
/// dispatch through the same path.
LayoutPage _wirePage(String deckId, LayoutPage page) => LayoutPage(
      id: deckId,
      grid: page.grid,
      version: page.version,
      widgets: page.widgets,
    );

// ---------------------------------------------------------------------------
// Initial mock state — EVERY id the seven pages bind, with believable values.
// The telemetry ticker (mock_deck_source) animates the sys.*/net.*/media/page
// metrics; the rest change via actions.
// ---------------------------------------------------------------------------

Map<String, Object?> seedInitialState() => {
      // ── Now playing (dashboard / media / notifications) ─────────────────────
      'media': const {
        'track': 'Blinding Lights',
        'artist': 'The Weeknd',
        'playing': true,
        'progress': 0.38,
        'elapsed': 76,
        'duration': 200,
      },
      'media.volume': 70.0,
      'media.playing': true,
      'media.muted': false,
      'media.volume.system': 70.0,
      'media.volume.spotify': 55.0,
      'media.volume.browser': 40.0,
      'media.volume.discord': 65.0,

      // ── CPU / GPU / RAM core telemetry ──────────────────────────────────────
      'sys.cpu.temp': 52.0,
      'sys.cpu.temp.min': 38.0,
      'sys.cpu.temp.max': 71.0,
      'sys.cpu.temp.avg': 54.0,
      'sys.gpu.temp': 61.0,
      'sys.gpu.temp.min': 44.0,
      'sys.gpu.temp.max': 82.0,
      'sys.gpu.temp.avg': 63.0,
      'sys.ram': 62.0, // % used (dashboard / gaming / notifications gauges)
      'sys.ram.used': '10.2 GB',
      'sys.ram.free': '5.8 GB',
      'sys.ram.total': '16.0 GB',
      'sys.cpu.load': 28.0,
      'sys.gpu.load': 67.0,

      // ── System status / info text ───────────────────────────────────────────
      'sys.power.plan': 'Balanced',
      'sys.network': 'Connected',
      'sys.storage.free': '512 GB Free',
      'sys.storage.used': 58.0,
      'sys.uptime': '2d 14h 36m 52s',
      // Dashboard status card (bound map; live on a connected engine via system.status).
      'sys.status': const {
        'powerPlan': 'Balanced',
        'network': 'Connected',
        'storage': '512 GB Free',
        'uptime': '2d 14h 36m',
      },
      'sys.clock': '10:30 AM',
      'sys.info.os': 'Windows 11 Pro',
      'sys.info.cpu': 'AMD Ryzen 9 7900X',
      'sys.info.gpu': 'NVIDIA RTX 4080',
      'sys.info.ram': '16 GB DDR5',

      // ── System Overview vitals / history / processes ────────────────────────
      'sys.storage.used.tb': 1.12,
      'sys.cpu.history': const [22, 26, 31, 28, 24, 30, 35, 29, 27, 31],
      'sys.gpu.history': const [60, 64, 71, 67, 63, 69, 74, 66, 70, 67],
      'sys.perf.min': 18.0,
      'sys.perf.avg': 42.0,
      'sys.perf.max': 88.0,
      'sys.health.score': 92.0,
      'sys.storage.usedPct': 58.0,
      'sys.storage.system': 120.0,
      'sys.storage.apps': 240.0,
      'sys.storage.media': 410.0,
      'sys.storage.free.gb': 230.0,
      'sys.proc.0.cpu': 18.0,
      'sys.proc.1.cpu': 12.0,
      'sys.proc.2.cpu': 7.0,
      'sys.proc.3.cpu': 5.0,
      'sys.proc.4.cpu': 3.0,

      // ── System Control: network · storage volumes · fans ────────────────────
      'net.download': 125.6,
      'net.upload': 18.0,
      'net.ping': 18.0,
      'net.download.series': const [110, 118, 132, 125, 121, 130, 126, 124],
      'net.upload.series': const [14, 16, 19, 18, 17, 20, 18, 18],
      'net.ping.series': const [16, 18, 22, 19, 17, 20, 18, 18],
      'storage.c.percent': 58.0,
      'storage.d.percent': 73.0,
      'storage.e.percent': 41.0,
      'storage.f.percent': 22.0,
      'fan.cpu.percent': 45.0,
      'fan.case1.percent': 38.0,
      'fan.auto': true,

      // ── Gaming Hub live metrics + optimization toggles ──────────────────────
      'game.fps': 144.0,
      'game.profile.active': 'Competitive',
      'game.opt.performance': true,
      'game.opt.networkBoost': false,
      'game.opt.gpuOverclock': false,
      'game.opt.tempControl': true,

      // ── Media Center weather ────────────────────────────────────────────────
      'weather.temp': 21.0,
      'weather.condition': 'Partly Cloudy',

      // ── Smart Home: weather · energy · rooms · devices · cameras ────────────
      'home.weather.temp': 22.0,
      'home.weather.humidity': 48.0,
      'home.energy.now': 285.0,
      'home.energy.today': 8.4,
      'home.energy.cost': r'$3.20',
      'sh.room.living.temp': 22.5,
      'sh.room.bedroom.temp': 20.0,
      'sh.room.kitchen.temp': 23.0,
      'sh.room.office.temp': 21.5,
      'sh.room.bathroom.temp': 24.0,
      'home.lights.ceiling': true,
      'home.lights.floor': false,
      'home.tv': false,
      'home.speaker': true,
      'home.ac': true,
      'home.coffee': false,
      'home.auto.sunset': true,
      'home.cam.front': 'LIVE',
      'home.cam.back': 'LIVE',
      'home.cam.garage': 'OFFLINE',
    };
