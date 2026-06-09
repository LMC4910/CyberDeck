import 'package:cyberdeck_client/render/render.dart';
import 'package:cyberdeck_client/render/widgets/gauge_common.dart';
import 'package:cyberdeck_client/render/widgets/widget_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

WidgetNode gaugeNode(
  String id, {
  String type = 'gauge.circular',
  String? binding = 'system.cpu.percent',
  Map<String, dynamic> style = const {},
  Map<String, dynamic> config = const {},
  List<dynamic> valueRules = const [],
}) =>
    WidgetNode(
      id: id,
      type: type,
      placement: const Placement(col: 0, row: 0),
      appearance:
          Appearance(style: style, stateBinding: binding, valueRules: valueRules),
      config: config,
    );

Future<LayoutInterpreter> pumpGauge(WidgetTester tester, WidgetNode n) async {
  final interp = LayoutInterpreter(registry: RendererRegistry.withBuiltins());
  // A 1×1 grid so the single gauge fills the test box (the default 24×18 grid
  // would give it a ~1px cell).
  interp.load(LayoutPage(
    id: 'p',
    grid: const GridConfig(columns: 1, rows: 1, gutter: 0, marginX: 8, marginY: 8),
    widgets: [n],
  ));
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(
      body: SizedBox(width: 300, height: 300, child: interp.build()),
    ),
  ));
  return interp;
}

void main() {
  group('gauge helpers', () {
    test('gaugeFraction normalises and clamps', () {
      expect(gaugeFraction(50, 0, 100), 0.5);
      expect(gaugeFraction(0, 0, 100), 0.0);
      expect(gaugeFraction(150, 0, 100), 1.0); // clamp high
      expect(gaugeFraction(-10, 0, 100), 0.0); // clamp low
      expect(gaugeFraction(null, 0, 100), 0.0);
      expect(gaugeFraction('25', 0, 100), 0.25); // numeric string
      expect(gaugeFraction(5, 0, 0), 0.0); // degenerate range
    });

    test('formatValue appends unit and shows -- when null', () {
      expect(formatValue(null, '°C'), '--');
      expect(formatValue(42, '°C'), '42°C');
      expect(formatValue(42.5, '%'), '42.5%');
      expect(formatValue(42, null), '42');
    });

    test('gaugeAccent flips at the valueRules threshold (zero round-trip)', () {
      final n = gaugeNode('g', valueRules: [
        {'when': '>85', 'style': {'theme': 'status-error'}},
      ]);
      expect(gaugeAccent(50, n), kDefaultAccent); // below threshold → base accent
      expect(gaugeAccent(90, n), themeColor('status-error')); // above → error
    });
  });

  testWidgets('circular gauge renders its bound value and updates on delta',
      (tester) async {
    final interp = await pumpGauge(
      tester,
      gaugeNode('c1', config: {'min': 0, 'max': 100, 'unit': '%'}),
    );
    interp.applyState('system.cpu.percent', 42);
    await tester.pump();
    expect(find.byKey(const Key('gauge-value-c1')), findsOneWidget);
    expect(find.text('42%'), findsOneWidget);

    interp.applyState('system.cpu.percent', 73); // delta update
    await tester.pump();
    expect(find.text('73%'), findsOneWidget);
    expect(find.text('42%'), findsNothing);
  });

  testWidgets('circular gauge shows -- before any value arrives', (tester) async {
    await pumpGauge(tester, gaugeNode('c2'));
    expect(find.text('--'), findsOneWidget);
  });

  testWidgets('linear gauge renders its bound value', (tester) async {
    final interp = await pumpGauge(
      tester,
      gaugeNode('l1', type: 'gauge.linear', config: {'unit': '%'}),
    );
    interp.applyState('system.cpu.percent', 60);
    await tester.pump();
    expect(find.byKey(const Key('gauge-value-l1')), findsOneWidget);
    expect(find.text('60%'), findsOneWidget);
  });

  testWidgets('gauge.bar alias resolves to the linear gauge', (tester) async {
    final interp = await pumpGauge(
      tester,
      gaugeNode('b1', type: 'gauge.bar'),
    );
    interp.applyState('system.cpu.percent', 10);
    await tester.pump();
    expect(find.byKey(const Key('gauge-value-b1')), findsOneWidget);
    expect(find.byKey(const Key('unknown-widget-placeholder')), findsNothing);
  });
}
