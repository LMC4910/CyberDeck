/// Media Center page (Wave 1) — the deck's audio/media command surface.
///
/// Authored under the GRANULARITY MODEL: every visual "card" is a glass [panel]
/// placed FIRST (so the interpreter, painting in list order, sits it BEHIND),
/// then small BARE widgets (the media player, sliders, launchers, tiles, poster
/// launchers, notification rows, weather labels) are layered ON TOP — each one
/// individually editable in the Designer.
///
/// Mirrors "Reference Images/media.png": Now Playing (large media.player) +
/// Audio Control sliders along the top, a far-right column of Notifications /
/// Upcoming Events / Weather, then Quick Access launchers + Media Tools tiles,
/// and a Recently Played poster row across the bottom.
///
/// Bound mock state ids (Wave 2 should seed these):
///   * media               — now-playing Map {track,artist,playing,progress,elapsed,duration}
///   * media.visualizer     — bool (drives the standalone visualizer animation)
///   * media.volume.system  — 0..100  (System Volume slider)
///   * media.volume.spotify — 0..100  (Spotify Volume slider)
///   * media.volume.browser — 0..100  (Browser Volume slider)
///   * media.volume.discord — 0..100  (Discord Volume slider)
///   * weather.temp         — num (°C, Weather hero label)
///   * weather.condition    — String (Weather caption label)
library;

import '../../render/model.dart';
import 'builders.dart';

/// Brand cyan accent (matches [DeckColors.accentCyan]).
const String _cyan = '#00B4D8';

/// Brand purple accent (matches [DeckColors.accentPurple]).
const String _purple = '#7B2FBE';

/// Builds the Media Center [LayoutPage] on a 24×16 grid.
LayoutPage mediaCenterPage() {
  final widgets = <WidgetNode>[
    // ---------------------------------------------------------------- NOW PLAYING
    // Panel first (behind), then the rich media player layered on top.
    panel(
      'mc.nowplaying.panel',
      placement: at(0, 0, colSpan: 10, rowSpan: 5),
      title: 'Now Playing',
      accent: _purple,
    ),
    mediaPlayer(
      'mc.nowplaying.player',
      placement: at(1, 1, colSpan: 8, rowSpan: 4),
      stateBinding: 'media',
      track: 'Blinding Lights',
      artist: 'The Weeknd',
      duration: 200,
      color: _purple,
    ),

    // --------------------------------------------------------------- AUDIO CONTROL
    panel(
      'mc.audio.panel',
      placement: at(10, 0, colSpan: 7, rowSpan: 5),
      title: 'Audio Control',
      accent: _cyan,
    ),
    label(
      'mc.audio.system.label',
      placement: at(11, 1, colSpan: 3, rowSpan: 1),
      text: 'System Volume',
      font: 'body',
    ),
    slider(
      'mc.audio.system.slider',
      placement: at(11, 1, colSpan: 5, rowSpan: 1),
      stateBinding: 'media.volume.system',
      action: 'media.volume.set',
      color: _cyan,
    ),
    label(
      'mc.audio.spotify.label',
      placement: at(11, 2, colSpan: 3, rowSpan: 1),
      text: 'Spotify',
      font: 'body',
    ),
    slider(
      'mc.audio.spotify.slider',
      placement: at(11, 2, colSpan: 5, rowSpan: 1),
      stateBinding: 'media.volume.spotify',
      action: 'media.volume.set',
      color: '#1DB954',
    ),
    label(
      'mc.audio.browser.label',
      placement: at(11, 3, colSpan: 3, rowSpan: 1),
      text: 'Browser',
      font: 'body',
    ),
    slider(
      'mc.audio.browser.slider',
      placement: at(11, 3, colSpan: 5, rowSpan: 1),
      stateBinding: 'media.volume.browser',
      action: 'media.volume.set',
      color: _cyan,
    ),
    label(
      'mc.audio.discord.label',
      placement: at(11, 4, colSpan: 3, rowSpan: 1),
      text: 'Discord',
      font: 'body',
    ),
    slider(
      'mc.audio.discord.slider',
      placement: at(11, 4, colSpan: 5, rowSpan: 1),
      stateBinding: 'media.volume.discord',
      action: 'media.volume.set',
      color: _purple,
    ),

    // ---------------------------------------------------------------- NOTIFICATIONS
    panel(
      'mc.notif.panel',
      placement: at(17, 0, colSpan: 7, rowSpan: 6),
      title: 'Notifications',
      accent: _cyan,
    ),
    notificationItem(
      'mc.notif.1',
      placement: at(18, 1, colSpan: 5, rowSpan: 1),
      title: 'Spotify',
      body: 'New release from The Weeknd',
      time: '2m',
      icon: 'star',
      color: '#1DB954',
    ),
    notificationItem(
      'mc.notif.2',
      placement: at(18, 2, colSpan: 5, rowSpan: 1),
      title: 'System Update',
      body: 'Audio drivers updated',
      time: '14m',
      icon: 'info',
      color: _cyan,
    ),
    notificationItem(
      'mc.notif.3',
      placement: at(18, 3, colSpan: 5, rowSpan: 1),
      title: 'Discord',
      body: 'Friend joined Voice channel',
      time: '23m',
      icon: 'mic',
      color: _purple,
    ),
    notificationItem(
      'mc.notif.4',
      placement: at(18, 4, colSpan: 5, rowSpan: 1),
      title: 'Storage',
      body: 'Media library backed up',
      time: '1h',
      icon: 'check',
      color: '#00E676',
    ),

    // -------------------------------------------------------------- UPCOMING EVENTS
    panel(
      'mc.events.panel',
      placement: at(17, 6, colSpan: 7, rowSpan: 5),
      title: 'Upcoming Events',
      accent: _purple,
    ),
    statusList(
      'mc.events.list',
      placement: at(18, 7, colSpan: 5, rowSpan: 3),
      color: _purple,
      items: const [
        {'label': 'Team Standup', 'value': '10:30', 'icon': 'clock'},
        {'label': 'Release Review', 'value': '14:00', 'icon': 'clock'},
        {'label': 'Album Drop', 'value': '18:00', 'icon': 'star'},
      ],
    ),

    // ---------------------------------------------------------------------- WEATHER
    panel(
      'mc.weather.panel',
      placement: at(17, 11, colSpan: 7, rowSpan: 5),
      title: 'Weather',
      accent: _cyan,
    ),
    label(
      'mc.weather.temp',
      placement: at(18, 12, colSpan: 3, rowSpan: 2),
      stateBinding: 'weather.temp',
      unit: '°C',
      font: 'display',
      color: _cyan,
    ),
    label(
      'mc.weather.condition',
      placement: at(18, 14, colSpan: 5, rowSpan: 1),
      stateBinding: 'weather.condition',
      text: 'Clear Night',
      font: 'body',
    ),

    // --------------------------------------------------------------- QUICK ACCESS
    panel(
      'mc.quick.panel',
      placement: at(0, 5, colSpan: 10, rowSpan: 5),
      title: 'Quick Access',
      accent: _cyan,
    ),
    launcher(
      'mc.quick.spotify',
      placement: at(1, 6, colSpan: 2, rowSpan: 3),
      label: 'Spotify',
      icon: 'play',
      action: 'launch.spotify',
      color: '#1DB954',
    ),
    launcher(
      'mc.quick.youtube',
      placement: at(3, 6, colSpan: 2, rowSpan: 3),
      label: 'YouTube',
      icon: 'browser',
      action: 'launch.youtube',
      color: '#FF0000',
    ),
    launcher(
      'mc.quick.netflix',
      placement: at(5, 6, colSpan: 2, rowSpan: 3),
      label: 'Netflix',
      icon: 'camera',
      action: 'launch.netflix',
      color: '#E50914',
    ),
    launcher(
      'mc.quick.twitch',
      placement: at(7, 6, colSpan: 2, rowSpan: 3),
      label: 'Twitch',
      icon: 'game',
      action: 'launch.twitch',
      color: _purple,
    ),

    // ----------------------------------------------------------------- MEDIA TOOLS
    panel(
      'mc.tools.panel',
      placement: at(10, 5, colSpan: 7, rowSpan: 5),
      title: 'Media Tools',
      accent: _purple,
    ),
    controlTile(
      'mc.tools.screenshot',
      placement: at(11, 6, colSpan: 2, rowSpan: 3),
      label: 'Screenshot',
      icon: 'camera',
      action: 'media.screenshot',
      color: _cyan,
    ),
    controlTile(
      'mc.tools.record',
      placement: at(13, 6, colSpan: 2, rowSpan: 3),
      label: 'Record',
      icon: 'camera',
      action: 'media.record',
      color: '#FF5252',
    ),
    controlTile(
      'mc.tools.mute',
      placement: at(15, 6, colSpan: 2, rowSpan: 3),
      label: 'Mute',
      icon: 'mute',
      action: 'media.mute',
      color: _purple,
    ),

    // -------------------------------------------------------------- RECENTLY PLAYED
    panel(
      'mc.recent.panel',
      placement: at(0, 10, colSpan: 17, rowSpan: 6),
      title: 'Recently Played',
      accent: _purple,
    ),
    launcher(
      'mc.recent.1',
      placement: at(1, 11, colSpan: 3, rowSpan: 4),
      label: 'Starboy',
      action: 'media.play.recent1',
      color: _cyan,
    ),
    launcher(
      'mc.recent.2',
      placement: at(4, 11, colSpan: 3, rowSpan: 4),
      label: 'After Hours',
      action: 'media.play.recent2',
      color: _purple,
    ),
    launcher(
      'mc.recent.3',
      placement: at(7, 11, colSpan: 3, rowSpan: 4),
      label: 'Dawn FM',
      action: 'media.play.recent3',
      color: '#1DB954',
    ),
    launcher(
      'mc.recent.4',
      placement: at(10, 11, colSpan: 3, rowSpan: 4),
      label: 'Nightcall',
      action: 'media.play.recent4',
      color: '#FF5252',
    ),
    launcher(
      'mc.recent.5',
      placement: at(13, 11, colSpan: 3, rowSpan: 4),
      label: 'Midnight City',
      action: 'media.play.recent5',
      color: _cyan,
    ),
  ];

  return LayoutPage(
    id: 'media_center',
    grid: const GridConfig(columns: 24, rows: 16),
    widgets: widgets,
  );
}
