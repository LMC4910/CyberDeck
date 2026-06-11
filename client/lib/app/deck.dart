/// Deck screen: renders the engine-authored layout live and sends interactions.
///
/// On connect it builds the [LayoutInterpreter] from the engine's `layout.snapshot`,
/// applies subsequent `state.delta`s (gauges update with zero round-trip) and any
/// `layout.op`s, and routes a widget's gesture-slot interaction (PROJ-187) to the
/// engine over the control channel — destructive actions require a 2-tap confirm.
library;

import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';

import '../gestures/slots.dart';
import '../net/connection_manager.dart';
import '../net/envelope.dart';
import '../render/render.dart';

/// How long a destructive action stays "armed" awaiting the confirming second tap.
const Duration _confirmWindow = Duration(seconds: 3);

class DeckScreen extends StatefulWidget {
  const DeckScreen({super.key, required this.connection, this.onDisconnect});

  final EngineConnection connection;
  final VoidCallback? onDisconnect;

  @override
  State<DeckScreen> createState() => _DeckScreenState();
}

class _DeckScreenState extends State<DeckScreen> {
  late final LayoutInterpreter _interp;
  final List<StreamSubscription<Envelope>> _subs = [];
  bool _haveLayout = false;
  bool _connected = true;

  // 2-tap confirm state for destructive actions.
  String? _armedId;
  DateTime? _armedAt;

  @override
  void initState() {
    super.initState();
    _interp = LayoutInterpreter(registry: RendererRegistry.withBuiltins());
    _interp.interactionSink = _onInteraction;

    final r = widget.connection.router;
    _subs.add(r.layout.listen(_onLayout, onError: (_) {}, onDone: _onDisconnected));
    _subs.add(r.state.listen(_onState, onError: (_) {}));
  }

  void _onLayout(Envelope env) {
    try {
      final m = jsonDecode(utf8.decode(env.payload)) as Map<String, dynamic>;
      if (env.type == 'layout.snapshot') {
        _interp.load(LayoutPage.fromJson(m));
        if (mounted) setState(() => _haveLayout = true);
      } else if (env.type == 'layout.op') {
        _interp.applyOp(LayoutOp.fromJson(m));
      }
    } catch (_) {
      // A malformed layout frame is ignored rather than crashing the deck.
    }
  }

  void _onState(Envelope env) {
    try {
      final m = jsonDecode(utf8.decode(env.payload)) as Map<String, dynamic>;
      final id = m['id'] as String?;
      if (id != null) _interp.applyState(id, m['value']);
    } catch (_) {}
  }

  void _onDisconnected() {
    if (mounted) setState(() => _connected = false);
  }

  // Routes a widget's gesture-slot interaction to the engine (action targets only
  // in this slice). Destructive widgets (config.confirm == true) require a 2-tap.
  void _onInteraction(WidgetNode node, String slot, {Object? value}) {
    final target = interactionFor(node, slot);
    if (target == null || target.isNone || target.kind != 'action') return;

    if (node.config['confirm'] == true && !_confirmed(node.id, target.ref)) {
      return;
    }
    _send(target.ref);
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

  void _send(String actionId) {
    final payload = utf8.encode(jsonEncode({'actionId': actionId}));
    unawaited(widget.connection.router
        .send(Channel.control, 'interaction', payload)
        .catchError((_) => _onDisconnected()));
  }

  @override
  void dispose() {
    for (final s in _subs) {
      unawaited(s.cancel());
    }
    _interp.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E14),
      appBar: AppBar(
        title: const Text('CyberDeck'),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(children: [
              Icon(Icons.circle,
                  size: 12,
                  color: _connected ? Colors.greenAccent : Colors.redAccent),
              const SizedBox(width: 6),
              Text(_connected ? 'live' : 'offline',
                  key: const Key('deck-conn-badge')),
            ]),
          ),
          IconButton(
            key: const Key('deck-disconnect'),
            icon: const Icon(Icons.logout),
            onPressed: widget.onDisconnect,
          ),
        ],
      ),
      body: Opacity(
        opacity: _connected ? 1.0 : 0.5, // dim the last frame when disconnected
        child: _haveLayout
            ? Padding(padding: const EdgeInsets.all(8), child: _interp.build())
            : const Center(child: Text('Waiting for layout…')),
      ),
    );
  }
}
