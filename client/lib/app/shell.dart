/// The CyberDeck app shell (Wave 1): the cyberpunk "Control Center" chrome that
/// frames the deck canvas. It composes three regions over a full-bleed
/// [BackgroundGradient]:
///
///  * a left NAV RAIL — logo on top, a column of destination icons (Dashboard /
///    Apps / Media / System / Security), and settings + power pinned to the
///    bottom. The active destination is highlighted with an accent pill, a left
///    accent bar and a soft glow. Selecting a destination switches the hosted
///    deck/page.
///  * a TOP BAR — the page title (display font) + a muted subtitle on the left;
///    a live ticking clock, a settings gear and the connection [ConnectionBadge]
///    on the right.
///  * the CONTENT area — hosts the live [DeckScreen] (embedded, chrome-less) for
///    the selected deck, preserving Demo Mode / live engine, interaction routing,
///    the 2-tap confirm, and the Edit → Designer flow (driven from the top bar).
///
/// Everything visual is composed from the design-system kit (`theme/surfaces`,
/// `theme/tokens`, `theme/fonts`) — no palette literals leak in here.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../data/deck_source.dart';
import '../theme/fonts.dart';
import '../theme/surfaces.dart';
import '../theme/tokens.dart';
import 'connection_badge.dart';
import 'deck.dart';

/// A single nav-rail destination. [deckId] is the deck the rail switches to when
/// the item is selected; when null the destination renders a "coming soon"
/// placeholder in the content area (so the full Control-Center rail is present
/// even before every page has a backing deck).
@immutable
class NavDestination {
  const NavDestination({
    required this.id,
    required this.icon,
    required this.label,
    this.deckId,
  });

  final String id;
  final IconData icon;
  final String label;
  final String? deckId;
}

/// The icons the Control-Center rail offers, in order. Each is bound to a deck id
/// when [decks] contains a deck whose id (or title) matches its [match] keys;
/// unmatched destinations keep their place in the rail with a placeholder body.
List<NavDestination> buildNavDestinations(List<DeckSummary> decks) {
  String? find(List<String> ids) {
    for (final id in ids) {
      for (final d in decks) {
        if (d.id == id) return d.id;
      }
    }
    return null;
  }

  return [
    // Dashboard is the rich Control Center home (the enriched 'dashboard'/'system'
    // deck) — never the Smart Home demo deck.
    NavDestination(
      id: 'dashboard',
      icon: Icons.dashboard_outlined,
      label: 'Dashboard',
      deckId: find(['dashboard', 'system']),
    ),
    // Apps / System / Security are placeholders until their pages are authored
    // (the Smart Home + Media demo decks remain reachable from the deck list).
    const NavDestination(
      id: 'apps',
      icon: Icons.apps_outlined,
      label: 'Apps',
    ),
    NavDestination(
      id: 'media',
      icon: Icons.play_circle_outline,
      label: 'Media',
      deckId: find(['media']),
    ),
    const NavDestination(
      id: 'system',
      icon: Icons.memory_outlined,
      label: 'System',
    ),
    const NavDestination(
      id: 'security',
      icon: Icons.shield_outlined,
      label: 'Security',
    ),
  ];
}

/// The app shell: nav rail + top bar + hosted deck canvas.
class AppShell extends StatefulWidget {
  const AppShell({
    super.key,
    required this.source,
    this.onExit,
  });

  /// The active data source (Demo Mode or a live engine).
  final DeckSource source;

  /// Called when the user backs out of the source (returns to landing).
  final VoidCallback? onExit;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  late List<NavDestination> _nav;
  int _selected = 0;

  // Drives the live ticking clock in the top bar.
  late Timer _clockTimer;
  DateTime _now = DateTime.now();

  // Lets the top-bar Edit button reach the embedded deck's openEditor().
  final GlobalKey<DeckScreenState> _deckKey = GlobalKey<DeckScreenState>();

  @override
  void initState() {
    super.initState();
    _nav = buildNavDestinations(widget.source.decks());
    // Default to the first destination that actually has a deck (Home/Dashboard).
    final firstWithDeck = _nav.indexWhere((d) => d.deckId != null);
    _selected = firstWithDeck < 0 ? 0 : firstWithDeck;
    _clockTimer = Timer.periodic(
      const Duration(seconds: 1),
      (_) => mounted ? setState(() => _now = DateTime.now()) : null,
    );
  }

  @override
  void dispose() {
    _clockTimer.cancel();
    super.dispose();
  }

  NavDestination get _current => _nav[_selected];

  void _select(int i) {
    if (i == _selected) return;
    setState(() => _selected = i);
  }

  // openEditor() reloads the deck in place (its own setState), so the shell just
  // forwards the request to the embedded deck via its GlobalKey.
  Future<void> _edit() => _deckKey.currentState?.openEditor() ?? Future.value();

  // The page title is the nav destination's label (e.g. "Dashboard") so the top
  // bar names the PAGE, not the backing deck's internal title.
  String _pageTitle() => _current.label;

  String _pageSubtitle() {
    final deckId = _current.deckId;
    if (deckId != null) {
      for (final d in widget.source.decks()) {
        if (d.id == deckId) return d.subtitle;
      }
    }
    return 'No deck assigned yet';
  }

  @override
  Widget build(BuildContext context) {
    final deckId = _current.deckId;
    return Scaffold(
      backgroundColor: DeckColors.bg,
      body: BackgroundGradient(
        child: SafeArea(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _NavRail(
                destinations: _nav,
                selectedIndex: _selected,
                onSelect: _select,
                onExit: widget.onExit,
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _TopBar(
                      title: _pageTitle(),
                      subtitle: _pageSubtitle(),
                      now: _now,
                      status: widget.source.status,
                      onEdit: deckId != null ? _edit : null,
                    ),
                    Expanded(
                      child: deckId != null
                          ? DeckScreen(
                              key: _deckKey,
                              source: widget.source,
                              deckId: deckId,
                              embedded: true,
                            )
                          : _ComingSoon(destination: _current),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The left navigation rail: logo, destinations, and pinned settings/power.
class _NavRail extends StatelessWidget {
  const _NavRail({
    required this.destinations,
    required this.selectedIndex,
    required this.onSelect,
    this.onExit,
  });

  final List<NavDestination> destinations;
  final int selectedIndex;
  final void Function(int index) onSelect;
  final VoidCallback? onExit;

  static const double _width = 72;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: _width,
      margin: const EdgeInsets.all(DeckSpacing.sm),
      decoration: BoxDecoration(
        gradient: cardGradient(),
        borderRadius: BorderRadius.circular(kCardRadius),
        border: Border.all(color: DeckColors.border, width: 1),
      ),
      child: Column(
        children: [
          const SizedBox(height: DeckSpacing.lg),
          const _Logo(),
          const SizedBox(height: DeckSpacing.lg),
          const _RailDivider(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: DeckSpacing.sm),
              children: [
                for (var i = 0; i < destinations.length; i++)
                  _NavButton(
                    destination: destinations[i],
                    selected: i == selectedIndex,
                    onTap: () => onSelect(i),
                  ),
              ],
            ),
          ),
          const _RailDivider(),
          const SizedBox(height: DeckSpacing.sm),
          _RailIcon(
            key: const Key('nav-settings'),
            icon: Icons.settings_outlined,
            tooltip: 'Settings',
            onTap: () {},
          ),
          _RailIcon(
            key: const Key('nav-power'),
            icon: Icons.power_settings_new,
            tooltip: onExit != null ? 'Disconnect' : 'Power',
            accent: DeckStatus.error.color,
            onTap: onExit ?? () {},
          ),
          const SizedBox(height: DeckSpacing.sm),
        ],
      ),
    );
  }
}

/// The CyberDeck rail logo: a gradient-tinted glyph.
class _Logo extends StatelessWidget {
  const _Logo();

  @override
  Widget build(BuildContext context) {
    return ShaderMask(
      shaderCallback: (rect) => accentGradient().createShader(rect),
      blendMode: BlendMode.srcIn,
      child: const Icon(Icons.bolt, size: 30, color: Colors.white),
    );
  }
}

class _RailDivider extends StatelessWidget {
  const _RailDivider();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 1,
      margin: const EdgeInsets.symmetric(horizontal: DeckSpacing.md),
      color: DeckColors.border,
    );
  }
}

/// A nav destination button: icon over a tiny label, with an accent pill + left
/// bar + glow when active.
class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.destination,
    required this.selected,
    required this.onTap,
  });

  final NavDestination destination;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = DeckColors.accentCyan;
    return Semantics(
      selected: selected,
      button: true,
      label: destination.label,
      child: Padding(
        padding: const EdgeInsets.symmetric(
            horizontal: DeckSpacing.sm, vertical: DeckSpacing.xs),
        child: Stack(
          children: [
            // Active left accent bar.
            if (selected)
              Positioned(
                left: 0,
                top: 8,
                bottom: 8,
                child: Container(
                  width: 3,
                  decoration: BoxDecoration(
                    gradient: accentGradient(
                        begin: Alignment.topCenter, end: Alignment.bottomCenter),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            Material(
              color: Colors.transparent,
              child: InkWell(
                key: Key('nav-${destination.id}'),
                onTap: onTap,
                borderRadius: BorderRadius.circular(DeckSpacing.radius + 2),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding: const EdgeInsets.symmetric(vertical: DeckSpacing.sm),
                  decoration: BoxDecoration(
                    color: selected
                        ? accent.withValues(alpha: 0.14)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(DeckSpacing.radius + 2),
                    border: Border.all(
                      color: selected
                          ? accent.withValues(alpha: 0.45)
                          : Colors.transparent,
                      width: 1,
                    ),
                    boxShadow: selected ? neonGlow(accent, intensity: 0.7) : null,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        destination.icon,
                        size: 22,
                        color: selected ? accent : DeckColors.textSecondary,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        destination.label,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: DeckType.body(
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          color: selected ? accent : DeckColors.textSecondary,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A plain (non-destination) rail icon button — settings / power.
class _RailIcon extends StatelessWidget {
  const _RailIcon({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.accent,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: IconButton(
        onPressed: onTap,
        icon: Icon(icon, size: 22),
        color: accent ?? DeckColors.textSecondary,
        splashRadius: 22,
      ),
    );
  }
}

/// The top bar: page title + subtitle (left), clock / gear / status (right).
class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.title,
    required this.subtitle,
    required this.now,
    required this.status,
    this.onEdit,
  });

  final String title;
  final String subtitle;
  final DateTime now;
  final ValueListenable<ConnStatus> status;
  final VoidCallback? onEdit;

  String get _clock {
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(now.hour)}:${two(now.minute)}';
  }

  String get _date {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', //
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return '${days[now.weekday - 1]} ${now.day} ${months[now.month - 1]}';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(
          0, DeckSpacing.sm, DeckSpacing.sm, DeckSpacing.xs),
      padding: const EdgeInsets.symmetric(
          horizontal: DeckSpacing.lg, vertical: DeckSpacing.md),
      decoration: BoxDecoration(
        gradient: cardGradient(),
        borderRadius: BorderRadius.circular(kCardRadius),
        border: Border.all(color: DeckColors.border, width: 1),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  key: const Key('shell-title'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: DeckType.heading(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: DeckColors.textPrimary,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: DeckType.body(
                    fontSize: 12,
                    color: DeckColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: DeckSpacing.lg),
          _Clock(clock: _clock, date: _date),
          const SizedBox(width: DeckSpacing.lg),
          if (onEdit != null)
            IconButton(
              key: const Key('shell-edit'),
              tooltip: 'Edit deck',
              onPressed: onEdit,
              icon: const Icon(Icons.edit_outlined, size: 20),
              color: DeckColors.textSecondary,
            ),
          IconButton(
            key: const Key('shell-settings'),
            tooltip: 'Settings',
            onPressed: () {},
            icon: const Icon(Icons.settings_outlined, size: 20),
            color: DeckColors.textSecondary,
          ),
          const SizedBox(width: DeckSpacing.xs),
          ConnectionBadge(status),
        ],
      ),
    );
  }
}

/// The right-aligned live clock: big HH:MM numerals over a muted date.
class _Clock extends StatelessWidget {
  const _Clock({required this.clock, required this.date});

  final String clock;
  final String date;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          clock,
          key: const Key('shell-clock'),
          style: DeckType.display(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: DeckColors.textPrimary,
            letterSpacing: 1.5,
          ),
        ),
        Text(
          date,
          style: DeckType.body(
            fontSize: 11,
            color: DeckColors.textSecondary,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

/// Placeholder body for a rail destination that has no backing deck yet.
class _ComingSoon extends StatelessWidget {
  const _ComingSoon({required this.destination});

  final NavDestination destination;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(DeckSpacing.xxl),
        child: CardChrome(
          accent: DeckColors.accentPurple,
          padding: const EdgeInsets.all(DeckSpacing.xxl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ShaderMask(
                shaderCallback: (rect) => accentGradient().createShader(rect),
                blendMode: BlendMode.srcIn,
                child: Icon(destination.icon, size: 48, color: Colors.white),
              ),
              const SizedBox(height: DeckSpacing.lg),
              Text(
                destination.label,
                style: DeckType.heading(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: DeckSpacing.sm),
              Text(
                'No deck assigned to this page yet.',
                textAlign: TextAlign.center,
                style: DeckType.body(
                  fontSize: 13,
                  color: DeckColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
