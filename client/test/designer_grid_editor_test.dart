import 'package:cyberdeck_client/designer/grid_editor.dart';
import 'package:cyberdeck_client/designer/op_model.dart';
import 'package:cyberdeck_client/render/render.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final ops = OpBuilder(pageId: 'p', docVersion: 3);

  group('buildChangeGrid emits a ChangeGrid op', () {
    test('carries every grid property + the page/version base', () {
      final op = buildChangeGrid(ops,
          columns: 12,
          rows: 9,
          gutter: 6,
          marginX: 10,
          marginY: 12,
          aspectRatio: 16 / 9,
          background: const {'color': '#000'});
      expect(op['op'], 'ChangeGrid');
      expect(op['pageId'], 'p');
      expect(op['docVersion'], 3);
      final g = op['grid'] as Map<String, dynamic>;
      expect(g['columns'], 12);
      expect(g['rows'], 9);
      expect(g['gutter'], 6);
      expect(g['marginX'], 10);
      expect(g['marginY'], 12);
      expect(g['aspectRatio'], closeTo(16 / 9, 1e-9));
      expect(g['background'], {'color': '#000'});
    });

    test('NO hard caps — a very large grid passes through unchanged', () {
      final op = buildChangeGrid(ops,
          columns: 512, rows: 384, gutter: 0, marginX: 0, marginY: 0);
      final g = op['grid'] as Map<String, dynamic>;
      expect(g['columns'], 512);
      expect(g['rows'], 384);

      // And the renderer accepts it (re-renders at the large grid).
      final interp = LayoutInterpreter(registry: RendererRegistry.withBuiltins());
      interp.load(const LayoutPage(id: 'p'));
      interp.applyOp(LayoutOp.fromJson(op));
      expect(interp.grid.columns, 512);
      expect(interp.grid.rows, 384);
    });

    test('only sanity bounds apply (no zero/negative/degenerate grid)', () {
      final op = buildChangeGrid(ops,
          columns: 0, rows: -5, gutter: -3, marginX: -1, marginY: -2, aspectRatio: 0);
      final g = op['grid'] as Map<String, dynamic>;
      expect(g['columns'], GridSanity.minCount);
      expect(g['rows'], GridSanity.minCount);
      expect(g['gutter'], GridSanity.minSpacing);
      expect(g['marginX'], GridSanity.minSpacing);
      expect(g['marginY'], GridSanity.minSpacing);
      expect(g['aspectRatio'], 1.0); // non-positive aspect → 1.0
    });
  });

  group('GridEditor widget', () {
    testWidgets('editing columns commits a ChangeGrid op and re-renders', (tester) async {
      final interp = LayoutInterpreter(registry: RendererRegistry.withBuiltins());
      interp.load(const LayoutPage(
        id: 'p',
        grid: GridConfig(columns: 24, rows: 18),
      ));
      Map<String, dynamic>? committed;

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: GridEditor(
            grid: interp.grid,
            opBuilder: ops,
            onCommit: (op) {
              committed = op;
              interp.applyOp(LayoutOp.fromJson(op));
            },
          ),
        ),
      ));

      expect(find.byKey(const Key('grid-editor')), findsOneWidget);

      // Enter a large column count with no cap.
      await tester.enterText(find.byKey(const Key('grid-columns')), '200');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pump();

      expect(committed, isNotNull);
      expect(committed!['op'], 'ChangeGrid');
      expect((committed!['grid'] as Map)['columns'], 200);
      expect(interp.grid.columns, 200); // re-rendered at the new grid
    });

    testWidgets('seeds its fields from the current grid', (tester) async {
      final interp = LayoutInterpreter(registry: RendererRegistry.withBuiltins());
      interp.load(const LayoutPage(
        id: 'p',
        grid: GridConfig(columns: 36, rows: 20, gutter: 4),
      ));
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: GridEditor(grid: interp.grid, opBuilder: ops, onCommit: (_) {}),
        ),
      ));
      expect(find.widgetWithText(TextFormField, '36'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, '20'), findsOneWidget);
    });
  });
}
