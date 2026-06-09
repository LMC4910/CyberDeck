import 'package:cyberdeck_client/render/render.dart';
import 'package:cyberdeck_client/render/widgets/label.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Future<({List<String> events, LayoutInterpreter interp})> pump(
  WidgetTester tester,
  List<WidgetNode> widgets,
) async {
  final events = <String>[];
  final interp = LayoutInterpreter(registry: RendererRegistry.withBuiltins())
    ..interactionSink =
        (node, slot, {value}) => events.add('${node.id}:$slot=$value');
  interp.load(LayoutPage(
    id: 'p',
    grid: const GridConfig(columns: 1, rows: 3, gutter: 0, marginX: 0, marginY: 0),
    widgets: widgets,
  ));
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(body: SizedBox(width: 400, height: 400, child: interp.build())),
  ));
  await tester.pump();
  return (events: events, interp: interp);
}

void main() {
  group('label formatting', () {
    test('formats a numeric value with a unit', () {
      expect(formatLabelValue(42.0, '°C'), '42.0 °C'); // double → one decimal
      expect(formatLabelValue(42, ''), '42'); // int as-is
      expect(formatLabelValue(42, '%'), '42 %');
      expect(formatLabelValue(null, '°C'), '--');
      expect(formatLabelValue('hi', ''), 'hi');
    });

    testWidgets('renders a bound numeric state with its unit', (tester) async {
      final r = await pump(tester, const [
        WidgetNode(
          id: 'l1',
          type: 'label',
          placement: Placement(col: 0, row: 0),
          appearance: Appearance(style: {'label': 'CPU'}, stateBinding: 's.cpu'),
          config: {'unit': '°C'},
        ),
      ]);
      r.interp.applyState('s.cpu', 42.0);
      await tester.pump();
      expect(find.text('CPU: 42.0 °C'), findsOneWidget);
    });
  });

  testWidgets('slider reflects bound state and emits dragValue within range',
      (tester) async {
    final r = await pump(tester, const [
      WidgetNode(
        id: 's1',
        type: 'slider',
        placement: Placement(col: 0, row: 0),
        appearance: Appearance(stateBinding: 's.vol'),
        config: {'min': 0, 'max': 100},
      ),
    ]);
    r.interp.applyState('s.vol', 30);
    await tester.pump();
    final sl = tester.widget<Slider>(find.byKey(const Key('slider-s1')));
    expect(sl.value, 30);

    // Drag to a new position → emits dragValue with the level.
    await tester.drag(find.byKey(const Key('slider-s1')), const Offset(100, 0));
    await tester.pump();
    expect(r.events.where((e) => e.startsWith('s1:dragValue=')), isNotEmpty);
  });

  testWidgets('image renders an icon', (tester) async {
    await pump(tester, const [
      WidgetNode(
        id: 'i1',
        type: 'image',
        placement: Placement(col: 0, row: 0),
        config: {'icon': 'play'},
      ),
    ]);
    expect(find.byKey(const Key('image-i1')), findsOneWidget);
    expect(find.byIcon(Icons.play_arrow), findsOneWidget);
  });
}
