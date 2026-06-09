import 'package:cyberdeck_client/designer/inspector/inspector.dart';
import 'package:cyberdeck_client/designer/inspector/param_schema.dart';
import 'package:cyberdeck_client/designer/op_model.dart';
import 'package:cyberdeck_client/render/render.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

WidgetNode widgetWith(Map<String, dynamic> config) => WidgetNode(
      id: 'w1',
      type: 'gauge.circular',
      placement: const Placement(col: 0, row: 0),
      config: config,
    );

Future<Map<String, dynamic>?> pumpInspector(
  WidgetTester tester,
  List<ParamSchema> schema, {
  Map<String, dynamic> config = const {},
}) async {
  Map<String, dynamic>? captured;
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(
      body: SizedBox(
        width: 600,
        height: 600,
        child: Inspector(
          widget: widgetWith(config),
          schema: schema,
          opBuilder: OpBuilder(pageId: 'page1', docVersion: 1),
          onCommit: (op) => captured = op,
        ),
      ),
    ),
  ));
  return captured; // null until an edit commits (read after interaction)
}

void main() {
  testWidgets('auto-generates the right editor per param type', (tester) async {
    await pumpInspector(tester, const [
      ParamSchema(name: 'min', type: ParamType.integer, min: 0, max: 100),
      ParamSchema(name: 'mode', type: ParamType.choice, choices: ['a', 'b', 'c']),
      ParamSchema(name: 'enabled', type: ParamType.boolean),
      ParamSchema(name: 'unit', type: ParamType.text),
      ParamSchema(name: 'target', type: ParamType.entity),
    ]);
    expect(find.byKey(const Key('slider-min')), findsOneWidget);
    expect(find.byKey(const Key('dropdown-mode')), findsOneWidget);
    expect(find.byKey(const Key('switch-enabled')), findsOneWidget);
    expect(find.byKey(const Key('field-unit')), findsOneWidget);
    expect(find.byKey(const Key('entity-stub')), findsOneWidget);
  });

  testWidgets('a brand-new choice action renders a working dropdown (no inspector code)',
      (tester) async {
    // A param type the inspector has never seen as a *specific param* — only the
    // generic 'choice' handling exists. P1-AC-10.
    Map<String, dynamic>? captured;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Inspector(
          widget: widgetWith(const {}),
          schema: const [
            ParamSchema(
                name: 'transition', type: ParamType.choice, choices: ['fade', 'slide', 'none']),
          ],
          opBuilder: OpBuilder(pageId: 'page1', docVersion: 3),
          onCommit: (op) => captured = op,
        ),
      ),
    ));
    expect(find.byKey(const Key('dropdown-transition')), findsOneWidget);

    await tester.tap(find.byKey(const Key('dropdown-transition')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('slide').last);
    await tester.pumpAndSettle();

    expect(captured, isNotNull);
    expect(captured!['op'], 'SetConfig');
    expect(captured!['widgetId'], 'w1');
    expect((captured!['config'] as Map)['transition'], 'slide');
  });

  testWidgets('editing a bool commits a SetConfig op', (tester) async {
    Map<String, dynamic>? captured;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Inspector(
          widget: widgetWith(const {'enabled': false}),
          schema: const [ParamSchema(name: 'enabled', type: ParamType.boolean)],
          opBuilder: OpBuilder(pageId: 'page1', docVersion: 1),
          onCommit: (op) => captured = op,
        ),
      ),
    ));
    await tester.tap(find.byKey(const Key('switch-enabled')));
    await tester.pump();

    expect(captured, isNotNull);
    expect(captured!['op'], 'SetConfig');
    expect((captured!['config'] as Map)['enabled'], true);
  });

  testWidgets('empty schema shows a placeholder', (tester) async {
    await pumpInspector(tester, const []);
    expect(find.byKey(const Key('inspector-empty')), findsOneWidget);
  });

  test('parseParamType maps synonyms', () {
    expect(parseParamType('int'), ParamType.integer);
    expect(parseParamType('enum'), ParamType.choice);
    expect(parseParamType('boolean'), ParamType.boolean);
    expect(parseParamType('mystery'), ParamType.unknown);
  });
}
