/// Layout interpreter + view (PROJ-181, 2C §7). Builds the widget tree once from a
/// [Page], then applies layout ops and state updates with disciplined repaint
/// (§7.2):
///
///  - a **state update** repaints only widgets bound to that state (each widget
///    listens to its bound state's notifier via a nested ValueListenableBuilder);
///  - a **per-widget op** (move/resize/style/binding/interaction/config) fires only
///    that widget's node notifier — the page and sibling widgets do not rebuild;
///  - a **structural op** (add/remove/grid) bumps the page structure notifier;
///  - an **unknown widget type** renders a safe placeholder, never crashing.
///
/// The interpreter also exposes the [subscriptionSet] (the union of bound state
/// ids) which drives the engine subscription (2C §7.2 / PROJ-150).
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'degradation.dart';
import 'model.dart';
import 'ops.dart';
import 'registry.dart';
import 'state_store.dart';

class LayoutInterpreter {
  LayoutInterpreter({required this.registry, ClientStateStore? stateStore})
      : stateStore = stateStore ?? ClientStateStore();

  final RendererRegistry registry;
  final ClientStateStore stateStore;

  /// Optional sink for widget gesture-slot interactions (wired by the app / PROJ-187).
  InteractionSink? interactionSink;

  final Map<String, ValueNotifier<WidgetNode>> _nodes = {};
  final List<String> _order = [];
  GridConfig _grid = const GridConfig();

  /// Bumped on structural changes (add/remove/grid); the view rebuilds its list.
  final ValueNotifier<int> structure = ValueNotifier<int>(0);

  /// True while the live link is down (PROJ-188). The deck surface keeps rendering
  /// each widget's LAST value but DIMMED, with a stale-link banner — it never
  /// freezes and never fabricates data (a never-received capability stays null →
  /// "--"). The deck screen drives this from the connection status; on reconnect it
  /// is cleared and live updates resume.
  final ValueNotifier<bool> degraded = ValueNotifier<bool>(false);

  /// The current set of bound state ids; updated when bindings change. The
  /// connection layer mirrors this to the engine's subscription set.
  final ValueNotifier<Set<String>> subscriptions =
      ValueNotifier<Set<String>>(const {});

  /// The current grid config.
  GridConfig get grid => _grid;

  /// The current widget order (ids).
  List<String> get widgetIds => List.unmodifiable(_order);

  /// The current union of bound state ids.
  Set<String> get subscriptionSet => {
        for (final id in _order)
          if (_nodes[id]!.value.appearance.stateBinding != null)
            _nodes[id]!.value.appearance.stateBinding!,
      };

  /// The node listenable for a widget id (for the view).
  ValueListenable<WidgetNode> nodeListenable(String id) => _nodes[id]!;

  /// Loads a page, building the node notifiers + structure.
  void load(LayoutPage page) {
    for (final n in _nodes.values) {
      n.dispose();
    }
    _nodes.clear();
    _order.clear();
    _grid = page.grid;
    for (final w in page.widgets) {
      _nodes[w.id] = ValueNotifier<WidgetNode>(w);
      _order.add(w.id);
    }
    _refreshSubscriptions();
    structure.value++;
  }

  /// Applies a state delta (repaints only widgets bound to [id]).
  void applyState(String id, Object? value) => stateStore.set(id, value);

  /// Enters/leaves degraded (offline) rendering (PROJ-188). Entering dims the deck
  /// over its last known values; leaving restores full brightness. Idempotent — it
  /// never touches state values, so it cannot freeze or fabricate live data.
  void setDegraded(bool value) => degraded.value = value;

  /// Applies a layout op to the local tree, repainting only affected nodes.
  void applyOp(LayoutOp op) {
    switch (op.kind) {
      case OpKind.addWidget:
        final node = op.widgetPayload();
        _nodes[node.id] = ValueNotifier<WidgetNode>(node);
        _order.add(node.id);
        _refreshSubscriptions();
        structure.value++;
      case OpKind.removeWidget:
        final id = op.widgetId;
        if (id != null && _nodes.containsKey(id)) {
          _nodes.remove(id)!.dispose();
          _order.remove(id);
          _refreshSubscriptions();
          structure.value++;
        }
      case OpKind.moveWidget:
        _updateNode(op.widgetId, (n) {
          final to = (op.raw['to'] as Map?)?.cast<String, dynamic>() ?? const {};
          return n.copyWith(
            placement: n.placement.copyWith(
              col: (to['col'] as num?)?.toInt(),
              row: (to['row'] as num?)?.toInt(),
            ),
          );
        });
      case OpKind.resizeWidget:
        _updateNode(op.widgetId, (n) {
          final to = (op.raw['to'] as Map?)?.cast<String, dynamic>() ?? const {};
          return n.copyWith(
            placement: n.placement.copyWith(
              colSpan: (to['colSpan'] as num?)?.toInt(),
              rowSpan: (to['rowSpan'] as num?)?.toInt(),
            ),
          );
        });
      case OpKind.setStyle:
        _updateNode(op.widgetId, (n) {
          final style = (op.raw['style'] as Map?)?.cast<String, dynamic>() ?? const {};
          return n.copyWith(
            appearance:
                n.appearance.copyWith(style: {...n.appearance.style, ...style}),
          );
        });
      case OpKind.setBinding:
        _updateNode(op.widgetId, (n) {
          final binding = op.raw['stateBinding'] as String?;
          return n.copyWith(
            appearance: n.appearance
                .copyWith(stateBinding: binding, clearBinding: binding == null),
          );
        });
        _refreshSubscriptions();
      case OpKind.setInteraction:
        _updateNode(op.widgetId, (n) {
          final interaction =
              (op.raw['interaction'] as Map?)?.cast<String, dynamic>() ?? const {};
          return n.copyWith(interaction: interaction);
        });
      case OpKind.setConfig:
        _updateNode(op.widgetId, (n) {
          final config = (op.raw['config'] as Map?)?.cast<String, dynamic>() ?? const {};
          return n.copyWith(config: {...n.config, ...config});
        });
      case OpKind.changeGrid:
        _grid = GridConfig.fromJson(
            (op.raw['grid'] as Map?)?.cast<String, dynamic>());
        structure.value++;
      case OpKind.unknown:
        break; // ignore unknown ops (forward-compat)
    }
  }

  void _updateNode(String? id, WidgetNode Function(WidgetNode) f) {
    if (id == null) return;
    final n = _nodes[id];
    if (n != null) n.value = f(n.value);
  }

  void _refreshSubscriptions() => subscriptions.value = subscriptionSet;

  /// Builds the page view, wrapped in the degradation overlay (PROJ-188): when
  /// [degraded] is true the deck dims over its last values; otherwise it renders
  /// live and untouched.
  Widget build() => DegradationOverlay(degraded: degraded, child: _LayoutView(this));

  void dispose() {
    for (final n in _nodes.values) {
      n.dispose();
    }
    _nodes.clear();
    structure.dispose();
    subscriptions.dispose();
    degraded.dispose();
    stateStore.dispose();
  }
}

/// The fixed cell edge (logical px) used by the runtime SCALE-TO-FIT canvas. The
/// deck is laid out once at a fixed design size built from this constant and the
/// page grid, then uniformly scaled into the viewport by a [FittedBox] — so a
/// page looks identical at every window size (thin letterbox if the aspect ratio
/// differs) and widgets never overflow because the window got smaller. The
/// Designer keeps using [GridConfig.cellWidth]/[cellHeight] for its own canvas.
const double kDesignCell = 60;

class _LayoutView extends StatelessWidget {
  const _LayoutView(this.interp);

  final LayoutInterpreter interp;

  @override
  Widget build(BuildContext context) {
    // Rebuilds the child set only on structural changes.
    return ValueListenableBuilder<int>(
      valueListenable: interp.structure,
      builder: (context, _, _) {
        final grid = interp.grid;
        // Fixed design canvas geometry (independent of the live viewport).
        final cols = grid.columns > 0 ? grid.columns : 1;
        final rows = grid.rows > 0 ? grid.rows : 1;
        final designW = grid.marginX * 2 +
            cols * kDesignCell +
            (cols - 1) * grid.gutter;
        final designH = grid.marginY * 2 +
            rows * kDesignCell +
            (rows - 1) * grid.gutter;
        // Build the Stack/Positioned tree at the FIXED design size, then scale it
        // uniformly into whatever space we're given, centred (BoxFit.contain).
        return Center(
          child: FittedBox(
            fit: BoxFit.contain,
            child: SizedBox(
              width: designW,
              height: designH,
              child: Stack(
                children: [
                  for (final id in interp.widgetIds)
                    _positioned(id, grid, kDesignCell, kDesignCell),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _positioned(String id, GridConfig grid, double cellW, double cellH) {
    // Placement is read once per structural rebuild for layout; per-widget moves
    // also bump structure-independent node notifiers, so we read the live value.
    final node = interp.nodeListenable(id).value;
    final p = node.placement;
    return Positioned(
      key: ValueKey('pos-$id'),
      left: grid.marginX + p.col * (cellW + grid.gutter),
      top: grid.marginY + p.row * (cellH + grid.gutter),
      width: p.colSpan * cellW + (p.colSpan - 1) * grid.gutter,
      height: p.rowSpan * cellH + (p.rowSpan - 1) * grid.gutter,
      child: RenderedWidget(
        key: ValueKey('w-$id'),
        node: interp.nodeListenable(id),
        store: interp.stateStore,
        registry: interp.registry,
        onInteraction: interp.interactionSink,
      ),
    );
  }
}

/// Renders a single widget node: rebuilds when its node changes (per-widget op) or
/// its bound state changes (state update) — and nothing else.
class RenderedWidget extends StatelessWidget {
  const RenderedWidget({
    super.key,
    required this.node,
    required this.store,
    required this.registry,
    this.onInteraction,
  });

  final ValueListenable<WidgetNode> node;
  final ClientStateStore store;
  final RendererRegistry registry;
  final InteractionSink? onInteraction;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<WidgetNode>(
      valueListenable: node,
      builder: (context, n, _) {
        final binding = n.appearance.stateBinding;
        if (binding == null) return _content(context, n, null);
        return ValueListenableBuilder<Object?>(
          valueListenable: store.listenable(binding),
          builder: (context, value, _) => _content(context, n, value),
        );
      },
    );
  }

  Widget _content(BuildContext context, WidgetNode n, Object? value) {
    final builder = registry.builderFor(n.type);
    if (builder == null) return buildUnknownPlaceholder(context, n);
    return builder(context,
        WidgetRenderContext(node: n, value: value, onInteraction: onInteraction));
  }
}
