/// Deck screen: renders a deck from a [DeckSource] (Demo Mode or a live engine),
/// applies live state updates, and routes widget interactions back to the source.
/// Destructive actions (config.confirm) require a 2-tap confirm. An Edit button
/// opens the Designer.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../data/deck_source.dart';
import '../designer/deck_editor.dart';
import '../gestures/slots.dart';
import '../render/render.dart';

/// How long a destructive action stays "armed" awaiting the confirming second tap.
const Duration _confirmWindow = Duration(seconds: 3);

class DeckScreen extends StatefulWidget {
  const DeckScreen({
    super.key,
    required this.source,
    required this.deckId,
    this.onBack,
  });

  final DeckSource source;
  final String deckId;
  final VoidCallback? onBack;

  @override
  State<DeckScreen> createState() => _DeckScreenState();
}

class _DeckScreenState extends State<DeckScreen> {
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
      if (value != null) 'value': value,
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E14),
      appBar: AppBar(
        leading: widget.onBack != null
            ? IconButton(
                key: const Key('deck-back'),
                icon: const Icon(Icons.arrow_back),
                onPressed: widget.onBack)
            : null,
        title: Text(_title),
        actions: [
          _StatusBadge(widget.source.status),
          IconButton(
            key: const Key('deck-edit'),
            icon: const Icon(Icons.edit),
            tooltip: 'Edit deck',
            onPressed: _openEditor,
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: _interp.build(),
        ),
      ),
    );
  }
}

/// The connection status pill in the app bar.
class _StatusBadge extends StatelessWidget {
  const _StatusBadge(this.status);
  final ValueListenable<ConnStatus> status;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Center(
        child: ValueListenableBuilder<ConnStatus>(
          valueListenable: status,
          builder: (context, s, _) {
            final (color, text) = switch (s) {
              ConnStatus.demo => (Colors.cyanAccent, 'demo'),
              ConnStatus.connecting => (Colors.amberAccent, 'connecting'),
              ConnStatus.connected => (Colors.greenAccent, 'live'),
              ConnStatus.disconnected => (Colors.redAccent, 'offline'),
            };
            return Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.circle, size: 11, color: color),
              const SizedBox(width: 6),
              Text(text, key: const Key('deck-conn-badge')),
            ]);
          },
        ),
      ),
    );
  }
}
