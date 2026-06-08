import 'package:cyberdeck_client/render/render.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// A registry whose 'counted' builder records how many times each widget id built.
({RendererRegistry registry, Map<String, int> counts}) countingRegistry() {
  final counts = <String, int>{};
  final r = RendererRegistry();
  r.register('counted', (context, ctx) {
    counts[ctx.node.id] = (counts[ctx.node.id] ?? 0) + 1;
    return Text('${ctx.node.id}:${ctx.value}', key: Key('t-${ctx.node.id}'));
  });
  return (registry: r, counts: counts);
}

WidgetNode node(String id, {String type = 'counted', String? binding, int row = 0}) =>
    WidgetNode(
      id: id,
      type: type,
      placement: Placement(col: 0, row: row),
      appearance: Appearance(stateBinding: binding),
    );

Future<LayoutInterpreter> pumpInterpreter(
  WidgetTester tester,
  RendererRegistry registry,
  LayoutPage page,
) async {
  final interp = LayoutInterpreter(registry: registry);
  interp.load(page);
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(
      body: SizedBox(width: 800, height: 600, child: interp.build()),
    ),
  ));
  return interp;
}

void main() {
  testWidgets('builds a widget tree from a layout doc', (tester) async {
    final reg = RendererRegistry.withBuiltins();
    final page = LayoutPage(id: 'p1', widgets: [
      const WidgetNode(
        id: 'l1',
        type: 'label',
        placement: Placement(col: 0, row: 0),
        appearance: Appearance(style: {'label': 'CPU'}, stateBinding: 'system.cpu'),
      ),
    ]);
    final interp = await pumpInterpreter(tester, reg, page);
    interp.applyState('system.cpu', 42);
    await tester.pump();
    expect(find.text('CPU: 42'), findsOneWidget);
  });

  testWidgets('unknown widget type renders a safe placeholder', (tester) async {
    final reg = RendererRegistry.withBuiltins();
    final page = LayoutPage(id: 'p', widgets: [node('m1', type: 'mystery.widget')]);
    await pumpInterpreter(tester, reg, page);
    expect(find.byKey(const Key('unknown-widget-placeholder')), findsOneWidget);
    expect(find.textContaining('mystery.widget'), findsOneWidget);
  });

  testWidgets('a state update repaints only the bound widget', (tester) async {
    final cr = countingRegistry();
    final page = LayoutPage(id: 'p', widgets: [
      node('A', binding: 'sx', row: 0),
      node('B', binding: 'sy', row: 1),
    ]);
    final interp = await pumpInterpreter(tester, cr.registry, page);
    expect(cr.counts['A'], 1);
    expect(cr.counts['B'], 1);

    interp.applyState('sx', 99);
    await tester.pump();

    expect(cr.counts['A'], 2); // bound widget repainted
    expect(cr.counts['B'], 1); // sibling untouched
  });

  testWidgets('a per-widget op repaints only that widget', (tester) async {
    final cr = countingRegistry();
    final page = LayoutPage(id: 'p', widgets: [
      node('A', row: 0),
      node('B', row: 1),
    ]);
    final interp = await pumpInterpreter(tester, cr.registry, page);
    expect(cr.counts['A'], 1);
    expect(cr.counts['B'], 1);

    interp.applyOp(LayoutOp.fromJson({
      'op': 'SetStyle',
      'widgetId': 'A',
      'style': {'label': 'X'},
    }));
    await tester.pump();

    expect(cr.counts['A'], 2);
    expect(cr.counts['B'], 1);
  });

  testWidgets('AddWidget adds a node to the tree', (tester) async {
    final cr = countingRegistry();
    final page = LayoutPage(id: 'p', widgets: [node('A', row: 0)]);
    final interp = await pumpInterpreter(tester, cr.registry, page);
    expect(find.byKey(const Key('t-A')), findsOneWidget);
    expect(find.byKey(const Key('t-C')), findsNothing);

    interp.applyOp(LayoutOp.fromJson({
      'op': 'AddWidget',
      'widget': {'id': 'C', 'type': 'counted', 'placement': {'col': 0, 'row': 1}},
    }));
    await tester.pump();

    expect(find.byKey(const Key('t-C')), findsOneWidget);
    expect(interp.widgetIds, contains('C'));
  });

  testWidgets('RemoveWidget removes a node', (tester) async {
    final cr = countingRegistry();
    final page = LayoutPage(id: 'p', widgets: [node('A', row: 0), node('B', row: 1)]);
    final interp = await pumpInterpreter(tester, cr.registry, page);
    expect(find.byKey(const Key('t-B')), findsOneWidget);

    interp.applyOp(LayoutOp.fromJson({'op': 'RemoveWidget', 'widgetId': 'B'}));
    await tester.pump();

    expect(find.byKey(const Key('t-B')), findsNothing);
    expect(interp.widgetIds, isNot(contains('B')));
  });

  test('subscriptionSet reflects bindings and updates on SetBinding', () {
    final interp = LayoutInterpreter(registry: RendererRegistry());
    interp.load(LayoutPage(id: 'p', widgets: [
      node('A', binding: 'sx'),
      node('B'),
    ]));
    expect(interp.subscriptionSet, {'sx'});

    interp.applyOp(LayoutOp.fromJson(
        {'op': 'SetBinding', 'widgetId': 'B', 'stateBinding': 'sy'}));
    expect(interp.subscriptionSet, {'sx', 'sy'});
    expect(interp.subscriptions.value, {'sx', 'sy'});
  });

  test('parses a layout doc from JSON', () {
    final page = LayoutPage.fromJson({
      'id': 'p2',
      'version': 7,
      'grid': {'columns': 12, 'rows': 8},
      'widgets': [
        {
          'id': 'w1',
          'type': 'gauge.circular',
          'placement': {'col': 1, 'row': 2, 'colSpan': 2, 'rowSpan': 2},
          'appearance': {
            'style': {'label': 'CPU'},
            'stateBinding': 'system.cpu.percent',
            'valueRules': [
              {'when': '>85', 'style': {'theme': 'status-error'}}
            ],
          },
        },
      ],
    });
    expect(page.version, 7);
    expect(page.grid.columns, 12);
    expect(page.widgets.single.appearance.stateBinding, 'system.cpu.percent');
    expect(page.widgets.single.placement.colSpan, 2);
  });

  test('evaluateValueRules matches numeric comparisons', () {
    final rules = [
      {'when': '>85', 'style': {'theme': 'status-error'}},
    ];
    expect(evaluateValueRules(90, rules)?['theme'], 'status-error');
    expect(evaluateValueRules(50, rules), isNull);
    expect(evaluateValueRules('92', rules)?['theme'], 'status-error');
  });
}
