import 'package:cyberdeck_client/render/render.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Future<({List<String> events, LayoutInterpreter interp})> pumpButtonToggle(
    WidgetTester tester) async {
  final events = <String>[];
  final interp = LayoutInterpreter(registry: RendererRegistry.withBuiltins())
    ..interactionSink = (node, slot, {value}) => events.add('${node.id}:$slot');
  interp.load(const LayoutPage(
    id: 'p',
    grid: GridConfig(columns: 1, rows: 2, gutter: 0, marginX: 0, marginY: 0),
    widgets: [
      WidgetNode(
        id: 'b1',
        type: 'button',
        placement: Placement(col: 0, row: 0),
        appearance: Appearance(style: {'label': 'Go'}),
      ),
      WidgetNode(
        id: 't1',
        type: 'toggle',
        placement: Placement(col: 0, row: 1),
        appearance: Appearance(stateBinding: 's.on'),
      ),
    ],
  ));
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(
      body: SizedBox(width: 400, height: 400, child: interp.build()),
    ),
  ));
  await tester.pump();
  return (events: events, interp: interp);
}

void main() {
  testWidgets('button renders, shows pressed-state, and emits its tap slot',
      (tester) async {
    final events = (await pumpButtonToggle(tester)).events;
    expect(find.text('Go'), findsOneWidget);
    expect(find.byKey(const Key('button-pressed-b1')), findsNothing);

    final g = await tester.startGesture(
        tester.getCenter(find.byKey(const Key('button-b1'))));
    await tester.pump(); // pressed-state is immediate (≤100ms)
    expect(find.byKey(const Key('button-pressed-b1')), findsOneWidget);

    await g.up();
    await tester.pump();
    expect(find.byKey(const Key('button-pressed-b1')), findsNothing);
    expect(events, contains('b1:tap'));
  });

  testWidgets('toggle reflects its bound boolean state and emits on tap',
      (tester) async {
    final r = await pumpButtonToggle(tester);
    final events = r.events;

    // Reflects the bound state.
    r.interp.applyState('s.on', true);
    await tester.pump();
    final sw =
        tester.widget<Switch>(find.byKey(const Key('toggle-switch-t1')));
    expect(sw.value, isTrue);

    // Tapping emits the tap slot (the mapped action performs the real toggle).
    await tester.tap(find.byKey(const Key('toggle-switch-t1')));
    await tester.pump();
    expect(events, contains('t1:tap'));
  });
}
