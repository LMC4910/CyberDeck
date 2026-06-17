/// Media Center page — the deck's audio/media command surface.
///
/// ONE WIDGET = ONE ENTITY: every visual CARD is a SINGLE composite node that
/// draws its OWN card chrome + all of its sub-content. There are NO `panel`
/// backgrounds with decomposed clusters layered on top. The rich now-playing
/// player, the volume cards, the notifications feed, the events list and the
/// recently-played posters are each one editor entity; the individual controls
/// (launchers + media-tool control tiles) are already single-entity tiles and
/// stay one node each.
///
/// Mirrors "Reference Images/media.png": a large Now Playing player + four
/// volume cards + a Notifications feed across the top; Quick Access launchers,
/// Media Tools control tiles and an Upcoming Events list across the middle; a
/// Recently Played poster row along the bottom.
///
/// Bound mock state ids (Wave 2 seeds these):
///   * media               — now-playing Map {track,artist,playing,progress,elapsed,duration}
///   * media.volume.system  — 0..100  (System volume card)
///   * media.volume.spotify — 0..100  (Spotify volume card)
///   * media.volume.browser — 0..100  (Browser volume card)
///   * media.volume.discord — 0..100  (Discord volume card)
library;

import '../../render/model.dart';
import 'builders.dart';

/// Brand cyan accent (matches [DeckColors.accentCyan]).
const String _cyan = '#00B4D8';

/// Brand purple accent (matches [DeckColors.accentPurple]).
const String _purple = '#7B2FBE';

/// Spotify / Discord / red brand tints reused below.
const String _spotify = '#1DB954';
const String _discord = '#5865F2';

/// Builds the Media Center [LayoutPage] on a 24×16 grid.
LayoutPage mediaCenterPage() {
  final widgets = <WidgetNode>[
    // ──────────────────────────────────────────────────────────── NOW PLAYING
    // A SINGLE composite card: the rich media player owns its own chrome, art,
    // visualizer, progress + transport. No panel behind it.
    mediaPlayer(
      'mc.nowplaying',
      placement: at(0, 0, colSpan: 10, rowSpan: 6),
      stateBinding: 'media',
      track: 'Blinding Lights',
      artist: 'The Weeknd',
      duration: 200,
      color: _purple,
    ),

    // ───────────────────────────────────────────────────────────── AUDIO / VOLUMES
    // Four single composite volume cards (slider card:true) — each its own
    // titled card with a vertical track + a % readout, bound to its source.
    slider(
      'mc.vol.system',
      placement: at(10, 0, colSpan: 2, rowSpan: 6),
      stateBinding: 'media.volume.system',
      action: 'volume.set',
      vertical: true,
      title: 'System',
      color: _cyan,
    ),
    slider(
      'mc.vol.spotify',
      placement: at(12, 0, colSpan: 2, rowSpan: 6),
      stateBinding: 'media.volume.spotify',
      action: 'volume.app.set',
      param: 'spotify',
      vertical: true,
      title: 'Spotify',
      color: _spotify,
    ),
    slider(
      'mc.vol.browser',
      placement: at(14, 0, colSpan: 2, rowSpan: 6),
      stateBinding: 'media.volume.browser',
      action: 'volume.app.set',
      param: 'browser',
      vertical: true,
      title: 'Browser',
      color: _cyan,
    ),
    slider(
      'mc.vol.discord',
      placement: at(16, 0, colSpan: 2, rowSpan: 6),
      stateBinding: 'media.volume.discord',
      action: 'volume.app.set',
      param: 'discord',
      vertical: true,
      title: 'Discord',
      color: _discord,
    ),

    // ──────────────────────────────────────────────────────────── NOTIFICATIONS
    // A SINGLE composite feed card (replaces per-item notification nodes).
    notificationList(
      'mc.notifications',
      placement: at(18, 0, colSpan: 6, rowSpan: 10),
      title: 'Notifications',
      color: _cyan,
      items: const [
        {
          'title': 'Spotify',
          'body': 'New release from The Weeknd',
          'time': '2m',
          'icon': 'star',
          'color': _spotify,
        },
        {
          'title': 'System Update',
          'body': 'Audio drivers updated',
          'time': '14m',
          'icon': 'info',
          'color': _cyan,
        },
        {
          'title': 'Discord',
          'body': 'Friend joined Voice channel',
          'time': '23m',
          'icon': 'mic',
          'color': _discord,
        },
        {
          'title': 'Storage',
          'body': 'Media library backed up',
          'time': '1h',
          'icon': 'check',
          'color': '#00E676',
        },
      ],
    ),

    // ──────────────────────────────────────────────────────────── QUICK ACCESS
    // Section label + individual launcher cards (each launcher is one entity).
    sectionHeader(
      'mc.quick.header',
      placement: at(0, 6, colSpan: 10, rowSpan: 1),
      title: 'Quick Access',
      color: _cyan,
    ),
    launcher(
      'mc.quick.spotify',
      placement: at(0, 7, colSpan: 2, rowSpan: 3),
      label: 'Spotify',
      icon: 'play',
      action: 'launch.url',
      param: 'https://open.spotify.com',
      color: _spotify,
    ),
    launcher(
      'mc.quick.youtube',
      placement: at(2, 7, colSpan: 2, rowSpan: 3),
      label: 'YouTube',
      icon: 'browser',
      action: 'launch.url',
      param: 'https://www.youtube.com',
      color: '#FF0000',
    ),
    launcher(
      'mc.quick.netflix',
      placement: at(4, 7, colSpan: 2, rowSpan: 3),
      label: 'Netflix',
      icon: 'camera',
      action: 'launch.url',
      param: 'https://www.netflix.com',
      color: '#E50914',
    ),
    launcher(
      'mc.quick.twitch',
      placement: at(6, 7, colSpan: 2, rowSpan: 3),
      label: 'Twitch',
      icon: 'game',
      action: 'launch.url',
      param: 'https://www.twitch.tv',
      color: _purple,
    ),
    launcher(
      'mc.quick.apple',
      placement: at(8, 7, colSpan: 2, rowSpan: 3),
      label: 'Apple Music',
      icon: 'play',
      action: 'launch.url',
      param: 'https://music.apple.com',
      color: '#FA57C1',
    ),

    // ───────────────────────────────────────────────────────────── MEDIA TOOLS
    // Section label + individual control tiles (each tile is one entity).
    sectionHeader(
      'mc.tools.header',
      placement: at(10, 6, colSpan: 8, rowSpan: 1),
      title: 'Media Tools',
      color: _purple,
    ),
    controlTile(
      'mc.tools.screenshot',
      placement: at(10, 7, colSpan: 2, rowSpan: 3),
      label: 'Screenshot',
      icon: 'camera',
      action: 'media.screenshot',
      color: _cyan,
    ),
    controlTile(
      'mc.tools.record',
      placement: at(12, 7, colSpan: 2, rowSpan: 3),
      label: 'Record',
      icon: 'camera',
      action: 'media.record',
      color: '#FF5252',
    ),
    controlTile(
      'mc.tools.cast',
      placement: at(14, 7, colSpan: 2, rowSpan: 3),
      label: 'Cast',
      icon: 'browser',
      action: 'media.cast',
      color: _purple,
    ),
    controlTile(
      'mc.tools.mute',
      placement: at(16, 7, colSpan: 2, rowSpan: 3),
      label: 'Mute',
      icon: 'mute',
      action: 'volume.mute',
      color: _purple,
    ),

    // ────────────────────────────────────────────────────────── UPCOMING EVENTS
    // A SINGLE composite list card (replaces per-row stat nodes).
    listCard(
      'mc.events',
      placement: at(18, 10, colSpan: 6, rowSpan: 6),
      title: 'Upcoming Events',
      color: _purple,
      items: const [
        {'leading': 'clock', 'label': 'Team Standup', 'value': '10:30'},
        {'leading': 'clock', 'label': 'Release Review', 'value': '14:00'},
        {'leading': 'star', 'label': 'Album Drop', 'value': '18:00'},
        {'leading': 'mic', 'label': 'Podcast Live', 'value': '21:00'},
      ],
    ),

    // ───────────────────────────────────────────────────────── RECENTLY PLAYED
    // Section label + a row of single composite game/album poster cards.
    sectionHeader(
      'mc.recent.header',
      placement: at(0, 10, colSpan: 18, rowSpan: 1),
      title: 'Recently Played',
      color: _purple,
    ),
    gamePoster(
      'mc.recent.1',
      placement: at(0, 11, colSpan: 3, rowSpan: 5),
      title: 'Starboy',
      subtitle: 'The Weeknd',
      // Opens the track via a YouTube search (real launch).
      action: 'launch.url',
      param: 'https://www.youtube.com/results?search_query=Starboy+The+Weeknd',
      color: _cyan,
    ),
    gamePoster(
      'mc.recent.2',
      placement: at(3, 11, colSpan: 3, rowSpan: 5),
      title: 'After Hours',
      subtitle: 'The Weeknd',
      action: 'launch.url',
      param: 'https://www.youtube.com/results?search_query=After+Hours+The+Weeknd',
      color: _purple,
    ),
    gamePoster(
      'mc.recent.3',
      placement: at(6, 11, colSpan: 3, rowSpan: 5),
      title: 'Dawn FM',
      subtitle: 'The Weeknd',
      action: 'launch.url',
      param: 'https://www.youtube.com/results?search_query=Dawn+FM+The+Weeknd',
      color: _spotify,
    ),
    gamePoster(
      'mc.recent.4',
      placement: at(9, 11, colSpan: 3, rowSpan: 5),
      title: 'Nightcall',
      subtitle: 'Kavinsky',
      action: 'launch.url',
      param: 'https://www.youtube.com/results?search_query=Nightcall+Kavinsky',
      color: '#FF5252',
    ),
    gamePoster(
      'mc.recent.5',
      placement: at(12, 11, colSpan: 3, rowSpan: 5),
      title: 'Midnight City',
      subtitle: 'M83',
      action: 'launch.url',
      param: 'https://www.youtube.com/results?search_query=Midnight+City+M83',
      color: _cyan,
    ),
    gamePoster(
      'mc.recent.6',
      placement: at(15, 11, colSpan: 3, rowSpan: 5),
      title: 'Random Access',
      subtitle: 'Daft Punk',
      action: 'launch.url',
      param: 'https://www.youtube.com/results?search_query=Random+Access+Daft+Punk',
      color: '#F2D900',
    ),
  ];

  return LayoutPage(
    id: 'media_center',
    grid: const GridConfig(columns: 24, rows: 16),
    widgets: widgets,
  );
}
