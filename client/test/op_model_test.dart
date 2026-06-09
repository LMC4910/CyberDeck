import 'package:cyberdeck_client/designer/op_model.dart';
import 'package:cyberdeck_client/render/render.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final b = OpBuilder(pageId: 'page1', docVersion: 7);

  group('OpBuilder emits the agreed op JSON', () {
    test('moveWidget', () {
      expect(b.moveWidget('w1', col: 3, row: 4), {
        'op': 'MoveWidget',
        'pageId': 'page1',
        'docVersion': 7,
        'widgetId': 'w1',
        'to': {'col': 3, 'row': 4},
      });
    });

    test('resizeWidget', () {
      expect(b.resizeWidget('w1', colSpan: 2, rowSpan: 3)['to'],
          {'colSpan': 2, 'rowSpan': 3});
    });

    test('setBinding includes/clears the binding', () {
      expect(b.setBinding('w1', 's.cpu')['stateBinding'], 's.cpu');
      expect(b.setBinding('w1', null).containsKey('stateBinding'), isFalse);
    });

    test('addWidget serialises the widget', () {
      final op = b.addWidget(const WidgetNode(
        id: 'w9',
        type: 'gauge.circular',
        placement: Placement(col: 1, row: 2, colSpan: 2, rowSpan: 2),
        appearance: Appearance(style: {'label': 'CPU'}, stateBinding: 's.cpu'),
      ));
      expect(op['op'], 'AddWidget');
      final w = op['widget'] as Map<String, dynamic>;
      expect(w['id'], 'w9');
      expect(w['placement'], {'col': 1, 'row': 2, 'colSpan': 2, 'rowSpan': 2});
      expect((w['appearance'] as Map)['stateBinding'], 's.cpu');
    });

    test('removePage / addPage', () {
      expect(b.removePage('page2')['pageId'], 'page2');
      final add = b.addPage('page3', grid: {'columns': 12});
      expect((add['page'] as Map)['id'], 'page3');
    });
  });

  test('built ops are accepted by the client interpreter (parity)', () {
    final interp = LayoutInterpreter(registry: RendererRegistry.withBuiltins());
    interp.load(const LayoutPage(id: 'page1', widgets: []));

    // AddWidget then MoveWidget, built by the Designer op builder.
    interp.applyOp(LayoutOp.fromJson(b.addWidget(const WidgetNode(
      id: 'wX',
      type: 'label',
      placement: Placement(col: 0, row: 0),
      appearance: Appearance(style: {'label': 'X'}),
    ))));
    expect(interp.widgetIds, contains('wX'));

    interp.applyOp(LayoutOp.fromJson(b.moveWidget('wX', col: 5, row: 6)));
    expect(interp.nodeListenable('wX').value.placement.col, 5);
    expect(interp.nodeListenable('wX').value.placement.row, 6);
  });
}
