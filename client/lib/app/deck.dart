/// Deck screen: renders a deck from a [DeckSource] (Demo Mode or a live engine),
/// applies live state updates, and routes widget interactions back to the source.
/// Destructive actions (config.confirm) require a 2-tap confirm. An Edit button
/// opens the Designer.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../data/deck_source.dart';
import '../designer/deck_editor.dart';
import '../gestures/slots.dart';
import '../render/render.dart';
import '../theme/surfaces.dart';
import '../theme/tokens.dart';
import 'connection_badge.dart';

/// How long a destructive action stays "armed" awaiting the confirming second tap.
const Duration _confirmWindow = Duration(seconds: 3);

class DeckScreen extends StatefulWidget {
  const DeckScreen({
    super.key,
    required this.source,
    required this.deckId,
    this.onBack,
    this.embedded = false,
  });

  final DeckSource source;
  final String deckId;
  final VoidCallback? onBack;

  /// When true the deck renders only its canvas (no [Scaffold]/[AppBar]) so it can
  /// be hosted inside the [AppShell]'s content area; the shell supplies the chrome
  /// (nav rail, top bar, Edit button). Interaction routing + 2-tap confirm are
  /// preserved in both modes. Defaults to false (standalone, used by screen tests).
  final bool embedded;

  @override
  State<DeckScreen> createState() => DeckScreenState();
}

class DeckScreenState extends State<DeckScreen> {
  late LayoutInterpreter _interp;
  StreamSubscription<StateUpdate>? _sub;
  String? _armedId;
  DateTime? _armedAt;

  @override
  void initState() {
    super.initState();
    _buildInterpreter();
  }

  void _buildInterpreter() {
    _interp = LayoutInterpreter(registry: RendererRegistry.withBuiltins())
      ..load(widget.source.layout(widget.deckId))
      ..interactionSink = _onInteraction;
    _sub = widget.source.states().listen((u) => _interp.applyState(u.id, u.value));
  }

  void _onInteraction(WidgetNode node, String slot, {Object? value}) {
    final target = interactionFor(node, slot);
    if (target == null || target.isNone || target.kind != 'action') return;
    if (node.config['confirm'] == true && !_confirmed(node.id, target.ref)) return;
    unawaited(_invoke(target.ref, value, target.param));
  }

  Future<void> _invoke(String actionId, Object? value, String? param) async {
    final params = <String, dynamic>{
      'value': ?value,
      if (param != null && param.isNotEmpty) 'target': param,
    };
    final outcome = await widget.source
        .invoke(actionId, params: params.isEmpty ? null : params);
    if (!mounted) return;
    final msg = outcome.message.isNotEmpty
        ? outcome.message
        : (outcome.ok ? 'Done' : 'Action failed');
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(msg), duration: const Duration(seconds: 2)));
  }

  bool _confirmed(String widgetId, String ref) {
    final now = DateTime.now();
    final armed = _armedId == widgetId &&
        _armedAt != null &&
        now.difference(_armedAt!) < _confirmWindow;
    if (armed) {
      _armedId = null;
      _armedAt = null;
      return true;
    }
    _armedId = widgetId;
    _armedAt = now;
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(
        content: Text('Tap again to confirm: $ref'),
        duration: _confirmWindow,
      ));
    return false;
  }

  /// Opens the Designer over this deck, then reloads to reflect saved edits.
  /// Exposed so the [AppShell]'s top-bar Edit button can drive it when the deck
  /// is hosted [DeckScreen.embedded].
  Future<void> openEditor() => _openEditor();

  Future<void> _openEditor() async {
    await Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => DeckEditor(source: widget.source, deckId: widget.deckId),
    ));
    // Reflect any saved edits.
    if (!mounted) return;
    setState(() {
      _sub?.cancel();
      _interp.dispose();
      _buildInterpreter();
    });
  }

  @override
  void dispose() {
    unawaited(_sub?.cancel());
    _interp.dispose();
    super.dispose();
  }

  String get _title {
    for (final d in widget.source.decks()) {
      if (d.id == widget.deckId) return d.title;
    }
    return 'Deck';
  }

  /// Public title accessor so a host shell can render it in its own top bar.
  String get title => _title;

  @override
  Widget build(BuildContext context) {
    // Embedded: just the deck canvas — the AppShell paints the chrome around it.
    if (widget.embedded) {
      return Padding(
        padding: const EdgeInsets.all(DeckSpacing.sm),
        child: _interp.build(),
      );
    }

    return Scaffold(
      backgroundColor: DeckColors.bg,
      appBar: AppBar(
        leading: widget.onBack != null
            ? IconButton(
                key: const Key('deck-back'),
                icon: const Icon(Icons.arrow_back),
                onPressed: widget.onBack)
            : null,
        title: Text(_title),
        actions: [
          ConnectionBadge(widget.source.status),
          IconButton(
            key: const Key('deck-edit'),
            icon: const Icon(Icons.edit),
            tooltip: 'Edit deck',
            onPressed: _openEditor,
          ),
        ],
      ),
      body: SafeArea(
        child: BackgroundGradient(
          child: Padding(
            padding: const EdgeInsets.all(DeckSpacing.sm),
            child: _interp.build(),
          ),
        ),
      ),
    );
  }
}

