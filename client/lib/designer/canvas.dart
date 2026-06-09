/// Designer canvas (PROJ-210, 2C §8.1 / ADR-0017/0018). The desktop WYSIWYG canvas
/// that renders a layout through the **same client renderer** (PROJ-181 — never fork
/// the renderer) sized to a target [DeviceClass] grid, with a grid overlay,
/// snap-to-grid placement and no-overlap collision prevention, plus a device-class
/// selector. Desktop-only authoring.
library;

import 'package:flutter/material.dart';

import '../render/render.dart';
import 'device_class.dart';
import 'placement.dart';

/// Drives edits on a [LayoutInterpreter] enforcing the placement rules (snap +
/// no-overlap) before emitting ops. Returns false when an edit is rejected.
class DesignerController {
  DesignerController(this.interpreter);

  final LayoutInterpreter interpreter;

  /// Current placements keyed by widget id.
  Map<String, Placement> placements() => {
        for (final id in interpreter.widgetIds)
          id: interpreter.nodeListenable(id).value.placement,
      };

  /// Moves a widget to (col,row), snapping into the grid and rejecting the move if
  /// it would overlap another widget (no-overlap, ADR-0017). Returns whether it
  /// applied.
  bool tryMove(String id, int col, int row) {
    final node = interpreter.nodeListenable(id).value;
    final target = clampToGrid(
      node.placement.copyWith(col: col, row: row),
      interpreter.grid,
    );
    final others = placements()..remove(id);
    if (anyOverlap(target, others.values)) return false;
    interpreter.applyOp(LayoutOp.fromJson({
      'op': 'MoveWidget',
      'widgetId': id,
      'to': {'col': target.col, 'row': target.row},
    }));
    return true;
  }

  /// Adds a widget at its placement, snapped into the grid and rejected on overlap.
  bool tryAdd(WidgetNode node) {
    final target = clampToGrid(node.placement, interpreter.grid);
    if (anyOverlap(target, placements().values)) return false;
    interpreter.applyOp(LayoutOp.fromJson({
      'op': 'AddWidget',
      'widget': {
        'id': node.id,
        'type': node.type,
        'placement': {
          'col': target.col,
          'row': target.row,
          'colSpan': target.colSpan,
          'rowSpan': target.rowSpan,
        },
        'appearance': {
          'style': node.appearance.style,
          if (node.appearance.stateBinding != null)
            'stateBinding': node.appearance.stateBinding,
        },
        'config': node.config,
      },
    }));
    return true;
  }

  /// Re-grids the canvas to a device class (re-renders at the new grid).
  void setDeviceClass(DeviceClass dc) {
    final g = dc.toGrid(
      gutter: interpreter.grid.gutter,
      marginX: interpreter.grid.marginX,
      marginY: interpreter.grid.marginY,
    );
    interpreter.applyOp(LayoutOp.fromJson({
      'op': 'ChangeGrid',
      'grid': {
        'columns': g.columns,
        'rows': g.rows,
        'gutter': g.gutter,
        'marginX': g.marginX,
        'marginY': g.marginY,
        'deviceClass': g.deviceClass,
      },
    }));
  }
}

/// The WYSIWYG designer canvas widget.
class DesignerCanvas extends StatefulWidget {
  const DesignerCanvas({
    super.key,
    required this.controller,
    this.deviceClasses = DeviceClass.presets,
    DeviceClass? initialClass,
  }) : initialClass = initialClass ?? DeviceClass.defaultClass;

  final DesignerController controller;
  final List<DeviceClass> deviceClasses;
  final DeviceClass initialClass;

  @override
  State<DesignerCanvas> createState() => _DesignerCanvasState();
}

class _DesignerCanvasState extends State<DesignerCanvas> {
  late DeviceClass _deviceClass = widget.initialClass;

  @override
  void initState() {
    super.initState();
    widget.controller.setDeviceClass(_deviceClass);
  }

  void _selectClass(DeviceClass? dc) {
    if (dc == null) return;
    setState(() => _deviceClass = dc);
    widget.controller.setDeviceClass(dc);
  }

  @override
  Widget build(BuildContext context) {
    final interp = widget.controller.interpreter;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.all(8),
          child: Row(
            children: [
              const Text('Device class: '),
              DropdownButton<DeviceClass>(
                key: const Key('device-class-selector'),
                value: _deviceClass,
                items: [
                  for (final dc in widget.deviceClasses)
                    DropdownMenuItem(value: dc, child: Text(dc.label)),
                ],
                onChanged: _selectClass,
              ),
            ],
          ),
        ),
        Expanded(
          child: Center(
            child: AspectRatio(
              aspectRatio: _deviceClass.aspectRatio,
              child: ValueListenableBuilder<int>(
                valueListenable: interp.structure,
                builder: (context, _, _) => Stack(
                  children: [
                    Positioned.fill(
                      child: CustomPaint(
                        key: const Key('designer-grid-overlay'),
                        painter: _GridOverlayPainter(interp.grid),
                      ),
                    ),
                    Positioned.fill(child: interp.build()),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Paints the device-class grid lines using the SAME cell geometry as the renderer
/// (`GridConfig.cellWidth/cellHeight`), so overlay and widgets align exactly.
class _GridOverlayPainter extends CustomPainter {
  _GridOverlayPainter(this.grid);

  final GridConfig grid;

  @override
  void paint(Canvas canvas, Size size) {
    final cellW = grid.cellWidth(size.width);
    final cellH = grid.cellHeight(size.height);
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.06)
      ..strokeWidth = 1;

    for (var c = 0; c <= grid.columns; c++) {
      final x = grid.marginX + c * (cellW + grid.gutter) - grid.gutter / 2;
      canvas.drawLine(Offset(x, grid.marginY),
          Offset(x, size.height - grid.marginY), paint);
    }
    for (var r = 0; r <= grid.rows; r++) {
      final y = grid.marginY + r * (cellH + grid.gutter) - grid.gutter / 2;
      canvas.drawLine(Offset(grid.marginX, y),
          Offset(size.width - grid.marginX, y), paint);
    }
  }

  @override
  bool shouldRepaint(_GridOverlayPainter old) =>
      old.grid.columns != grid.columns || old.grid.rows != grid.rows;
}
