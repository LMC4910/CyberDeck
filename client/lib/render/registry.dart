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
import 'widgets/image.dart';
import 'widgets/label.dart';
import 'widgets/launcher.dart';
import 'widgets/media_card.dart';
import 'widgets/media_player.dart';
import 'widgets/metric_tile.dart';
import 'widgets/page_nav.dart';
import 'widgets/section_header.dart';
import 'widgets/slider.dart';
import 'widgets/sparkline.dart';
import 'widgets/status_list.dart';
import 'widgets/toggle.dart';

/// Receives an interaction from a widget: the widget node and the gesture slot
/// (e.g. "tap"). The consumer maps `node.interaction[slot]` to an action / flow /
/// navigate target and dispatches it. The full gesture vocabulary + 2-tap confirm
/// is PROJ-187; this seam lets interactive widgets (button/toggle, PROJ-182) emit
/// their tap slot today.
typedef InteractionSink = void Function(WidgetNode node, String slot,
    {Object? value});

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

  /// Emits an interaction for [slot] (with an optional [value], e.g. a slider
  /// level) if a sink is wired.
  void emit(String slot, {Object? value}) =>
      onInteraction?.call(node, slot, value: value);
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
    r.register('slider', buildSlider);
    r.register('image', buildImage);
    r.register('gauge.circular', buildCircularGauge);
    r.register('gauge.linear', buildLinearGauge);
    r.register('gauge.bar', buildLinearGauge); // alias (2C §7.1 "linear gauge/bar")
    r.register('sparkline', buildSparkline); // PROJ-185
    r.register('media.card', buildMediaCard); // PROJ-186
    r.register('page.nav', buildPageNav); // PROJ-186
    // Wave 1 rich widgets (C2): card-chrome tiles + a full media player.
    r.register('launcher', buildLauncher);
    r.register('media.player', buildMediaPlayer);
    r.register('status.list', buildStatusList);
    r.register('metric.tile', buildMetricTile);
    r.register('section.header', buildSectionHeader);
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
