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

import 'model.dart';
import 'ops.dart';
import 'registry.dart';
import 'state_store.dart';

class LayoutInterpreter {
  LayoutInterpreter({required this.registry, ClientStateStore? stateStore})
      : stateStore = stateStore ?? ClientStateStore();

  final RendererRegistry registry;
  final ClientStateStore stateStore;

  final Map<String, ValueNotifier<WidgetNode>> _nodes = {};
  final List<String> _order = [];
  GridConfig _grid = const GridConfig();

  /// Bumped on structural changes (add/remove/grid); the view rebuilds its list.
  final ValueNotifier<int> structure = ValueNotifier<int>(0);

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

  /// Builds the page view.
  Widget build() => _LayoutView(this);

  void dispose() {
    for (final n in _nodes.values) {
      n.dispose();
    }
    _nodes.clear();
    structure.dispose();
    subscriptions.dispose();
    stateStore.dispose();
  }
}

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
        return LayoutBuilder(
          builder: (context, constraints) {
            final cellW = _cell(constraints.maxWidth, grid.marginX, grid.gutter,
                grid.columns);
            final cellH = _cell(_finite(constraints.maxHeight), grid.marginY,
                grid.gutter, grid.rows);
            return Stack(
              children: [
                for (final id in interp.widgetIds)
                  _positioned(id, grid, cellW, cellH),
              ],
            );
          },
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
      ),
    );
  }

  static double _finite(double v) => v.isFinite ? v : 600.0;

  static double _cell(double total, double margin, double gutter, int n) {
    if (n <= 0) return 0;
    final usable = total - 2 * margin - (n - 1) * gutter;
    final c = usable / n;
    return c.isFinite && c > 0 ? c : 1;
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
  });

  final ValueListenable<WidgetNode> node;
  final ClientStateStore store;
  final RendererRegistry registry;

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
    return builder(context, WidgetRenderContext(node: n, value: value));
  }
}
