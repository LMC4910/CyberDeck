import 'package:cyberdeck_client/designer/op_model.dart';
import 'package:cyberdeck_client/designer/undo.dart';
import 'package:cyberdeck_client/render/render.dart';
import 'package:flutter_test/flutter_test.dart';

// A LayoutInterpreter loaded with a couple of widgets, plus an UndoStack whose sink
// applies ops to it (the same apply path the Designer uses).
({LayoutInterpreter interp, UndoStack undo, OpBuilder ops}) fixture() {
  final interp = LayoutInterpreter(registry: RendererRegistry.withBuiltins());
  interp.load(LayoutPage(
    id: 'p',
    grid: const GridConfig(columns: 10, rows: 10),
    widgets: const [
      WidgetNode(
        id: 'w1',
        type: 'label',
        placement: Placement(col: 0, row: 0),
        appearance: Appearance(style: {'label': 'A'}),
      ),
      WidgetNode(
        id: 'w2',
        type: 'gauge.circular',
        placement: Placement(col: 4, row: 4, colSpan: 2, rowSpan: 2),
        appearance: Appearance(style: {'label': 'B'}, stateBinding: 's.cpu'),
      ),
    ],
  ));
  final undo = UndoStack(
    interpreter: interp,
    sink: (op) => interp.applyOp(LayoutOp.fromJson(op)),
  );
  return (interp: interp, undo: undo, ops: OpBuilder(pageId: 'p'));
}

void main() {
  group('UndoStack inverse correctness', () {
    test('move: undo restores prior cell, redo re-applies', () {
      final f = fixture();
      f.undo.record(f.ops.moveWidget('w1', col: 7, row: 8));
      expect(f.interp.nodeListenable('w1').value.placement.col, 7);

      f.undo.undo();
      expect(f.interp.nodeListenable('w1').value.placement.col, 0);
      expect(f.interp.nodeListenable('w1').value.placement.row, 0);

      f.undo.redo();
      expect(f.interp.nodeListenable('w1').value.placement.col, 7);
      expect(f.interp.nodeListenable('w1').value.placement.row, 8);
    });

    test('resize: undo restores prior span', () {
      final f = fixture();
      f.undo.record(f.ops.resizeWidget('w2', colSpan: 5, rowSpan: 1));
      expect(f.interp.nodeListenable('w2').value.placement.colSpan, 5);
      f.undo.undo();
      final p = f.interp.nodeListenable('w2').value.placement;
      expect(p.colSpan, 2);
      expect(p.rowSpan, 2);
    });

    test('setStyle: undo restores prior style map', () {
      final f = fixture();
      f.undo.record(f.ops.setStyle('w1', {'label': 'CHANGED'}));
      expect(f.interp.nodeListenable('w1').value.appearance.style['label'], 'CHANGED');
      f.undo.undo();
      expect(f.interp.nodeListenable('w1').value.appearance.style['label'], 'A');
    });

    test('setBinding: undo restores prior binding (and clearing round-trips)', () {
      final f = fixture();
      // Clear w2's binding, then undo -> restored.
      f.undo.record(f.ops.setBinding('w2', null));
      expect(f.interp.nodeListenable('w2').value.appearance.stateBinding, isNull);
      f.undo.undo();
      expect(f.interp.nodeListenable('w2').value.appearance.stateBinding, 's.cpu');
    });

    test('addWidget: undo removes it', () {
      final f = fixture();
      f.undo.record(f.ops.addWidget(const WidgetNode(
        id: 'w9',
        type: 'label',
        placement: Placement(col: 1, row: 1),
        appearance: Appearance(style: {'label': 'New'}),
      )));
      expect(f.interp.widgetIds, contains('w9'));
      f.undo.undo();
      expect(f.interp.widgetIds, isNot(contains('w9')));
      f.undo.redo();
      expect(f.interp.widgetIds, contains('w9'));
    });

    test('removeWidget: undo re-adds it with its content intact', () {
      final f = fixture();
      f.undo.record(f.ops.removeWidget('w2'));
      expect(f.interp.widgetIds, isNot(contains('w2')));
      f.undo.undo();
      expect(f.interp.widgetIds, contains('w2'));
      final n = f.interp.nodeListenable('w2').value;
      expect(n.placement.colSpan, 2);
      expect(n.appearance.stateBinding, 's.cpu');
    });

    test('changeGrid: undo restores prior grid', () {
      final f = fixture();
      f.undo.record(f.ops.changeGrid({'columns': 40, 'rows': 30}));
      expect(f.interp.grid.columns, 40);
      f.undo.undo();
      expect(f.interp.grid.columns, 10);
      expect(f.interp.grid.rows, 10);
    });
  });

  group('UndoStack multi-step', () {
    test('undo/redo walks a sequence of edits in order', () {
      final f = fixture();
      f.undo.record(f.ops.moveWidget('w1', col: 1, row: 1));
      f.undo.record(f.ops.moveWidget('w1', col: 2, row: 2));
      f.undo.record(f.ops.setStyle('w1', {'label': 'Z'}));

      expect(f.undo.canUndo, isTrue);
      expect(f.undo.canRedo, isFalse);

      f.undo.undo(); // undo style
      expect(f.interp.nodeListenable('w1').value.appearance.style['label'], 'A');
      f.undo.undo(); // undo move->2,2
      expect(f.interp.nodeListenable('w1').value.placement.col, 1);
      f.undo.undo(); // undo move->1,1
      expect(f.interp.nodeListenable('w1').value.placement.col, 0);
      expect(f.undo.canUndo, isFalse);

      f.undo.undo(); // no-op on empty stack
      expect(f.interp.nodeListenable('w1').value.placement.col, 0);

      f.undo.redo();
      expect(f.interp.nodeListenable('w1').value.placement.col, 1);
      f.undo.redo();
      expect(f.interp.nodeListenable('w1').value.placement.col, 2);
      f.undo.redo();
      expect(f.interp.nodeListenable('w1').value.appearance.style['label'], 'Z');
      expect(f.undo.canRedo, isFalse);
    });

    test('a new edit after undo clears the redo branch', () {
      final f = fixture();
      f.undo.record(f.ops.moveWidget('w1', col: 5, row: 5));
      f.undo.undo();
      expect(f.undo.canRedo, isTrue);
      f.undo.record(f.ops.moveWidget('w2', col: 8, row: 8));
      expect(f.undo.canRedo, isFalse);
      expect(f.interp.nodeListenable('w2').value.placement.col, 8);
    });

    test('recordApplied registers an externally-applied gesture as one step', () {
      final f = fixture();
      // Simulate a live drag: mutate the tree directly, then record net move.
      f.interp.applyOp(LayoutOp.fromJson(f.ops.moveWidget('w1', col: 9, row: 9)));
      f.undo.recordApplied(
        f.ops.moveWidget('w1', col: 9, row: 9),
        {'op': 'MoveWidget', 'widgetId': 'w1', 'to': {'col': 0, 'row': 0}},
      );
      expect(f.interp.nodeListenable('w1').value.placement.col, 9);
      f.undo.undo();
      expect(f.interp.nodeListenable('w1').value.placement.col, 0);
    });
  });
}
