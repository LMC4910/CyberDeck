import 'package:cyberdeck_client/designer/canvas.dart';
import 'package:cyberdeck_client/designer/placement.dart';
import 'package:cyberdeck_client/render/render.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

WidgetNode w(String id, int col, int row, {String type = 'label'}) => WidgetNode(
      id: id,
      type: type,
      placement: Placement(col: col, row: row),
      appearance: Appearance(style: {'label': id}),
    );

DesignerController controllerWith(List<WidgetNode> widgets) {
  final interp = LayoutInterpreter(registry: RendererRegistry.withBuiltins());
  interp.load(LayoutPage(
    id: 'p',
    grid: const GridConfig(columns: 10, rows: 10, gutter: 0, marginX: 0, marginY: 0),
    widgets: widgets,
  ));
  return DesignerController(interp);
}

void main() {
  group('placement helpers', () {
    const grid = GridConfig(columns: 10, rows: 10, gutter: 0, marginX: 0, marginY: 0);

    test('snapToCell maps an offset to the nearest cell', () {
      final p = snapToCell(const Offset(27, 52), grid, const Size(100, 100));
      expect(p.col, 3); // 27/10 → 2.7 → 3
      expect(p.row, 5); // 52/10 → 5.2 → 5
    });

    test('clampToGrid bounds origin + spans', () {
      final p = clampToGrid(
          const Placement(col: 100, row: -5, colSpan: 99, rowSpan: 1), grid);
      expect(p.colSpan, 10); // clamped to grid width
      expect(p.col, 0); // origin pushed back so span fits
      expect(p.row, 0); // negative clamped
    });

    test('overlaps detects intersection but not adjacency', () {
      expect(
          overlaps(const Placement(col: 0, row: 0, colSpan: 2, rowSpan: 2),
              const Placement(col: 1, row: 1)),
          isTrue);
      expect(
          overlaps(const Placement(col: 0, row: 0),
              const Placement(col: 1, row: 0)),
          isFalse); // adjacent
    });

    test('anyOverlap scans a set', () {
      final others = [const Placement(col: 2, row: 2), const Placement(col: 5, row: 5)];
      expect(anyOverlap(const Placement(col: 2, row: 2), others), isTrue);
      expect(anyOverlap(const Placement(col: 8, row: 8), others), isFalse);
    });
  });

  group('DesignerController', () {
    test('tryMove into a free cell applies', () {
      final c = controllerWith([w('A', 0, 0), w('B', 2, 0)]);
      expect(c.tryMove('A', 5, 5), isTrue);
      expect(c.placements()['A'], isA<Placement>());
      expect(c.placements()['A']!.col, 5);
      expect(c.placements()['A']!.row, 5);
    });

    test('tryMove into an occupied cell is rejected (no-overlap)', () {
      final c = controllerWith([w('A', 0, 0), w('B', 2, 0)]);
      expect(c.tryMove('A', 2, 0), isFalse); // would collide with B
      expect(c.placements()['A']!.col, 0); // unchanged
      expect(c.placements()['A']!.row, 0);
    });

    test('tryAdd rejects an overlapping new widget', () {
      final c = controllerWith([w('A', 0, 0)]);
      expect(c.tryAdd(w('C', 0, 0)), isFalse);
      expect(c.interpreter.widgetIds, isNot(contains('C')));
      expect(c.tryAdd(w('C', 4, 4)), isTrue);
      expect(c.interpreter.widgetIds, contains('C'));
    });
  });

  testWidgets('canvas renders widgets at the grid with an overlay', (tester) async {
    final c = controllerWith([w('w1', 0, 0)]);
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SizedBox(
          width: 800,
          height: 600,
          child: DesignerCanvas(controller: c),
        ),
      ),
    ));
    await tester.pump();
    expect(find.byKey(const Key('designer-grid-overlay')), findsOneWidget);
    expect(find.byKey(const Key('label-w1')), findsOneWidget);
  });

  testWidgets('selecting a device class re-grids the canvas', (tester) async {
    final c = controllerWith([w('w1', 0, 0)]);
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SizedBox(
          width: 800,
          height: 600,
          child: DesignerCanvas(controller: c),
        ),
      ),
    ));
    await tester.pump();
    // initState applied the default class (tablet-landscape-10 → 24 cols).
    expect(c.interpreter.grid.columns, 24);

    await tester.tap(find.byKey(const Key('device-class-selector')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Phone (portrait)').last);
    await tester.pumpAndSettle();

    expect(c.interpreter.grid.columns, 8); // re-gridded to the phone class
  });
}
