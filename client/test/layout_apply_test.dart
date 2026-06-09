import 'dart:convert';
import 'dart:typed_data';

import 'package:cyberdeck_client/net/envelope.dart';
import 'package:cyberdeck_client/net/layout_apply.dart';
import 'package:cyberdeck_client/render/render.dart';
import 'package:flutter_test/flutter_test.dart';

Envelope opEnv(Map<String, dynamic> op) => Envelope(
      ch: Channel.layout,
      type: 'layout.op',
      payload: Uint8List.fromList(utf8.encode(jsonEncode(op))),
    );

LayoutInterpreter interpWithW1() {
  final i = LayoutInterpreter(registry: RendererRegistry.withBuiltins());
  i.load(const LayoutPage(id: 'page1', widgets: [
    WidgetNode(id: 'w1', type: 'label', placement: Placement(col: 0, row: 0)),
  ]));
  return i;
}

void main() {
  test('applies an in-order op and advances the version', () {
    final interp = interpWithW1();
    final applier = LayoutApplier(interp, baseVersion: 1);

    applier.apply(opEnv({
      'op': 'MoveWidget',
      'widgetId': 'w1',
      'to': {'col': 5, 'row': 6},
      'docVersion': 2,
    }));

    expect(applier.lastVersion, 2);
    expect(interp.nodeListenable('w1').value.placement.col, 5);
    expect(interp.nodeListenable('w1').value.placement.row, 6);
  });

  test('a version gap triggers resync and is NOT applied', () {
    final interp = interpWithW1();
    var resyncs = 0;
    final applier =
        LayoutApplier(interp, baseVersion: 1, onResyncNeeded: () => resyncs++);

    applier.apply(opEnv({
      'op': 'MoveWidget',
      'widgetId': 'w1',
      'to': {'col': 9, 'row': 9},
      'docVersion': 4, // gap: expected 2
    }));

    expect(resyncs, 1);
    expect(applier.lastVersion, 1); // unchanged
    expect(interp.nodeListenable('w1').value.placement.col, 0); // not moved
  });

  test('a duplicate/old op is ignored', () {
    final interp = interpWithW1();
    final applier = LayoutApplier(interp, baseVersion: 5);
    applier.apply(opEnv({
      'op': 'MoveWidget',
      'widgetId': 'w1',
      'to': {'col': 1, 'row': 1},
      'docVersion': 3, // <= last
    }));
    expect(applier.lastVersion, 5);
    expect(interp.nodeListenable('w1').value.placement.col, 0);
  });

  test('sequential ops apply in order', () {
    final interp = interpWithW1();
    final applier = LayoutApplier(interp, baseVersion: 1);
    for (var v = 2; v <= 4; v++) {
      applier.apply(opEnv({
        'op': 'MoveWidget',
        'widgetId': 'w1',
        'to': {'col': v, 'row': 0},
        'docVersion': v,
      }));
    }
    expect(applier.lastVersion, 4);
    expect(interp.nodeListenable('w1').value.placement.col, 4);
  });
}
