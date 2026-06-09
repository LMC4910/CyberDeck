/// Renderer registry (PROJ-181, 2C §7.1 / ADR-0003): `widgetType → native builder`.
/// The client builds the widget tree from the layout doc using these builders;
/// plugin-provided types register additional builders in Phase 6 (the contract
/// exists in V1). An unknown type renders a safe placeholder — never a crash.
///
/// Builders are pure functions of (descriptor, bound value) so a rebuild is fully
/// determined by the node and its state.
library;

import 'package:flutter/material.dart';

import 'model.dart';
import 'widgets/gauge_circular.dart';
import 'widgets/button.dart';
import 'widgets/gauge_linear.dart';
import 'widgets/toggle.dart';

/// Receives an interaction from a widget: the widget node and the gesture slot
/// (e.g. "tap"). The consumer maps `node.interaction[slot]` to an action / flow /
/// navigate target and dispatches it. The full gesture vocabulary + 2-tap confirm
/// is PROJ-187; this seam lets interactive widgets (button/toggle, PROJ-182) emit
/// their tap slot today.
typedef InteractionSink = void Function(WidgetNode node, String slot);

/// Inputs to a widget builder: the descriptor node, its current bound value, and an
/// optional interaction sink.
class WidgetRenderContext {
  const WidgetRenderContext({
    required this.node,
    required this.value,
    this.onInteraction,
  });

  final WidgetNode node;

  /// The bound state's current value (null when unbound or not yet received).
  final Object? value;

  /// Sink for gesture-slot interactions (null = no-op).
  final InteractionSink? onInteraction;

  /// Emits an interaction for [slot] if a sink is wired.
  void emit(String slot) => onInteraction?.call(node, slot);
}

/// Builds a native widget from a render context.
typedef WidgetBuilderFn = Widget Function(BuildContext, WidgetRenderContext);

/// Maps widget types to builders.
class RendererRegistry {
  /// Creates an empty registry.
  RendererRegistry();

  final Map<String, WidgetBuilderFn> _builders = {};

  /// Registers (or replaces) the builder for a widget type.
  void register(String type, WidgetBuilderFn builder) {
    _builders[type] = builder;
  }

  /// The builder for a type, or null if unregistered.
  WidgetBuilderFn? builderFor(String type) => _builders[type];

  /// Whether a type has a registered builder.
  bool has(String type) => _builders.containsKey(type);

  /// A registry with the V1 reference built-ins registered. The richer core
  /// vocabulary (button/toggle/slider/gauges/…) is registered by PROJ-182–186 on
  /// this same contract.
  factory RendererRegistry.withBuiltins() {
    final r = RendererRegistry();
    r.register('label', buildLabel);
    r.register('button', buildButton);
    r.register('toggle', buildToggle);
    r.register('gauge.circular', buildCircularGauge);
    r.register('gauge.linear', buildLinearGauge);
    r.register('gauge.bar', buildLinearGauge); // alias (2C §7.1 "linear gauge/bar")
    return r;
  }
}

/// The safe placeholder for an unknown widget type (2C §7.2): visible, labelled,
/// never throwing.
Widget buildUnknownPlaceholder(BuildContext context, WidgetNode node) {
  return DecoratedBox(
    decoration: BoxDecoration(
      border: Border.all(color: Colors.orange.shade300),
      color: Colors.orange.withValues(alpha: 0.08),
    ),
    child: Center(
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: Text(
          'unknown: ${node.type}',
          key: const Key('unknown-widget-placeholder'),
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 11, color: Colors.orange),
        ),
      ),
    ),
  );
}

/// Reference built-in: a label that shows its style label and bound value, with
/// client-side [valueRules] applied for zero-latency conditional styling (2C §7.2).
Widget buildLabel(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final label = node.appearance.style['label'] as String? ?? '';
  final valueText = ctx.value == null ? '--' : '${ctx.value}';
  final matched = evaluateValueRules(ctx.value, node.appearance.valueRules);
  final isError = (matched?['theme'] as String?)?.contains('error') ?? false;

  return Center(
    child: Text(
      label.isEmpty ? valueText : '$label: $valueText',
      key: Key('label-${node.id}'),
      style: TextStyle(
        color: isError ? Colors.redAccent : null,
        fontWeight: isError ? FontWeight.bold : FontWeight.normal,
      ),
    ),
  );
}

/// Evaluates client-side value rules against a value, returning the first matching
/// rule's `style` map (or null). Supports `>`, `>=`, `<`, `<=`, `==` comparisons in
/// the rule's `when` string (e.g. `">85"`).
Map<String, dynamic>? evaluateValueRules(Object? value, List<dynamic> rules) {
  for (final raw in rules) {
    if (raw is! Map) continue;
    final rule = raw.cast<String, dynamic>();
    final when = rule['when'] as String?;
    if (when != null && _matches(value, when)) {
      return (rule['style'] as Map?)?.cast<String, dynamic>();
    }
  }
  return null;
}

bool _matches(Object? value, String when) {
  for (final op in const ['>=', '<=', '==', '>', '<']) {
    if (when.startsWith(op)) {
      final rhs = when.substring(op.length).trim();
      final lhs = (value is num) ? value : num.tryParse('$value');
      final rhsNum = num.tryParse(rhs);
      if (op == '==') return '$value' == rhs;
      if (lhs == null || rhsNum == null) return false;
      switch (op) {
        case '>=':
          return lhs >= rhsNum;
        case '<=':
          return lhs <= rhsNum;
        case '>':
          return lhs > rhsNum;
        case '<':
          return lhs < rhsNum;
      }
    }
  }
  return false;
}
