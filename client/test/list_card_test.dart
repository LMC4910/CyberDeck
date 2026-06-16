// Verifies the list.card live-row behaviour: a row with a `field` reads its value
// from the bound map state (live), falling back to its authored literal when the
// map (or that field) is absent. Rows without a `field` always show the literal.
import 'package:cyberdeck_client/render/render.dart';
import 'package:cyberdeck_client/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('list.card field rows go live from a bound map; literals fall back',
      (tester) async {
    const node = WidgetNode(
      id: 'lc',
      type: 'list.card',
      placement: Placement(col: 0, row: 0, colSpan: 6, rowSpan: 6),
      appearance: Appearance(stateBinding: 'sys.info'),
      config: {
        'items': [
          {'label': 'Operating System', 'field': 'os', 'value': 'Demo OS'},
          {'label': 'Motherboard', 'value': 'Demo Board'}, // no field → literal
        ],
      },
    );
    final interp = LayoutInterpreter(registry: RendererRegistry.withBuiltins())
      ..load(const LayoutPage(
        id: 'p',
        grid: GridConfig(columns: 6, rows: 6),
        widgets: [node],
      ));

    await tester.pumpWidget(MaterialApp(
      theme: buildDeckTheme(),
      home: Scaffold(body: interp.build()),
    ));
    await tester.pump();

    // No bound state yet → literal fallback.
    expect(find.text('Demo OS'), findsOneWidget);

    // Live map arrives → the field row updates; the no-field row keeps its literal.
    interp.applyState('sys.info', {'os': 'Windows 11 Pro'});
    await tester.pump();
    expect(find.text('Windows 11 Pro'), findsOneWidget);
    expect(find.text('Demo OS'), findsNothing);
    expect(find.text('Demo Board'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    interp.dispose();
  });
}
