/// Grid editor for the Designer (PROJ-217, 2C §2.1 / ADR-0017). Edits the page grid
/// — columns, rows, gutter, margins, aspect ratio and background — and emits the
/// existing `ChangeGrid` op (PROJ-211) so the change versions/broadcasts and the
/// canvas re-renders live. Per ADR-0017 there are NO hard column/row caps; only
/// *sanity* bounds (counts ≥ 1, spacing ≥ 0, finite aspect) so the document can
/// never be made degenerate. A 200-column "video wall" grid is perfectly legal.
library;

import 'package:flutter/material.dart';

import '../render/render.dart';
import 'op_model.dart';

/// Sanity bounds for a grid (NOT design caps — ADR-0017). These only prevent
/// degenerate documents (a zero-column grid, negative gutter, NaN aspect).
class GridSanity {
  /// Counts must be at least 1.
  static const int minCount = 1;

  /// Spacing (gutter/margins) must be non-negative.
  static const double minSpacing = 0;

  /// Aspect ratio must be positive + finite.
  static const double minAspect = 0.05;
  static const double maxAspect = 20.0;

  static int clampCount(int v) => v < minCount ? minCount : v;
  static double clampSpacing(double v) => v < minSpacing ? minSpacing : v;
  static double clampAspect(double v) =>
      (!v.isFinite || v <= 0) ? 1.0 : v.clamp(minAspect, maxAspect);
}

/// Builds the `ChangeGrid` op JSON for a desired grid. Applies only sanity bounds,
/// so large grids pass through unchanged. The [aspectRatio] is carried on the grid
/// map (the canvas reads it to size itself); [GridConfig] ignores unknown keys, so
/// this stays renderer-compatible.
Map<String, dynamic> buildChangeGrid(
  OpBuilder ops, {
  required int columns,
  required int rows,
  required double gutter,
  required double marginX,
  required double marginY,
  double? aspectRatio,
  Map<String, dynamic> background = const {},
}) =>
    ops.changeGrid({
      'columns': GridSanity.clampCount(columns),
      'rows': GridSanity.clampCount(rows),
      'gutter': GridSanity.clampSpacing(gutter),
      'marginX': GridSanity.clampSpacing(marginX),
      'marginY': GridSanity.clampSpacing(marginY),
      if (aspectRatio != null) 'aspectRatio': GridSanity.clampAspect(aspectRatio),
      if (background.isNotEmpty) 'background': background,
    });

/// The grid editor panel: live numeric fields for each grid property that commit a
/// `ChangeGrid` op via [onCommit]. No upper bounds on columns/rows.
class GridEditor extends StatefulWidget {
  const GridEditor({
    super.key,
    required this.grid,
    required this.opBuilder,
    required this.onCommit,
    this.aspectRatio,
  });

  /// The current grid (the editor seeds its fields from this).
  final GridConfig grid;

  /// Builds the ChangeGrid op.
  final OpBuilder opBuilder;

  /// Receives the op for each committed edit (apply + broadcast path).
  final void Function(Map<String, dynamic> op) onCommit;

  /// The canvas aspect ratio to seed the aspect field (optional).
  final double? aspectRatio;

  @override
  State<GridEditor> createState() => _GridEditorState();
}

class _GridEditorState extends State<GridEditor> {
  late int _columns = widget.grid.columns;
  late int _rows = widget.grid.rows;
  late double _gutter = widget.grid.gutter;
  late double _marginX = widget.grid.marginX;
  late double _marginY = widget.grid.marginY;
  late double _aspect = widget.aspectRatio ?? _aspectFromGrid(widget.grid);

  static double _aspectFromGrid(GridConfig g) {
    final a = g.background['aspectRatio'];
    return a is num ? a.toDouble() : 16 / 9;
  }

  void _commit() {
    widget.onCommit(buildChangeGrid(
      widget.opBuilder,
      columns: _columns,
      rows: _rows,
      gutter: _gutter,
      marginX: _marginX,
      marginY: _marginY,
      aspectRatio: _aspect,
      background: widget.grid.background,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      key: const Key('grid-editor'),
      shrinkWrap: true,
      padding: const EdgeInsets.all(12),
      children: [
        const Text('Grid', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        _intField('Columns', 'grid-columns', _columns, (v) => _columns = v),
        _intField('Rows', 'grid-rows', _rows, (v) => _rows = v),
        _doubleField('Gutter', 'grid-gutter', _gutter, (v) => _gutter = v),
        _doubleField('Margin X', 'grid-margin-x', _marginX, (v) => _marginX = v),
        _doubleField('Margin Y', 'grid-margin-y', _marginY, (v) => _marginY = v),
        _doubleField('Aspect ratio', 'grid-aspect', _aspect, (v) => _aspect = v),
      ],
    );
  }

  Widget _intField(String label, String key, int value, void Function(int) set) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: TextFormField(
        key: Key(key),
        initialValue: '$value',
        keyboardType: TextInputType.number,
        decoration: InputDecoration(labelText: label),
        onFieldSubmitted: (s) {
          final v = int.tryParse(s.trim());
          if (v == null) return;
          setState(() => set(GridSanity.clampCount(v)));
          _commit();
        },
      ),
    );
  }

  Widget _doubleField(
      String label, String key, double value, void Function(double) set) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: TextFormField(
        key: Key(key),
        initialValue: '$value',
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(labelText: label),
        onFieldSubmitted: (s) {
          final v = double.tryParse(s.trim());
          if (v == null) return;
          setState(() => set(v));
          _commit();
        },
      ),
    );
  }
}
