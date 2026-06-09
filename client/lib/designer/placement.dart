/// Placement geometry for the Designer (PROJ-210, 2C §3 / ADR-0017): snap a canvas
/// offset to a grid cell, clamp a placement inside the grid, and detect overlap
/// (placement is collision-free — no z-index in V1). Pure functions so the rules
/// are unit-tested independently of the canvas UI.
library;

import 'dart:ui';

import '../render/model.dart';

/// Snaps a canvas-local [offset] to the nearest grid cell, returning a placement
/// (keeping [span]) clamped inside the grid.
Placement snapToCell(
  Offset offset,
  GridConfig grid,
  Size canvas, {
  int colSpan = 1,
  int rowSpan = 1,
}) {
  final cellW = grid.cellWidth(canvas.width) + grid.gutter;
  final cellH = grid.cellHeight(canvas.height) + grid.gutter;
  final col = cellW <= 0 ? 0 : ((offset.dx - grid.marginX) / cellW).round();
  final row = cellH <= 0 ? 0 : ((offset.dy - grid.marginY) / cellH).round();
  return clampToGrid(
    Placement(col: col, row: row, colSpan: colSpan, rowSpan: rowSpan),
    grid,
  );
}

/// Clamps a placement so it fits within the grid (spans ≥1 and within bounds,
/// origin non-negative and not pushing the span off the edge).
Placement clampToGrid(Placement p, GridConfig grid) {
  final colSpan = p.colSpan.clamp(1, grid.columns);
  final rowSpan = p.rowSpan.clamp(1, grid.rows);
  final col = p.col.clamp(0, grid.columns - colSpan);
  final row = p.row.clamp(0, grid.rows - rowSpan);
  return Placement(col: col, row: row, colSpan: colSpan, rowSpan: rowSpan);
}

/// Whether two placements occupy any common cell (span-aware rectangle overlap).
bool overlaps(Placement a, Placement b) {
  final ax2 = a.col + a.colSpan;
  final ay2 = a.row + a.rowSpan;
  final bx2 = b.col + b.colSpan;
  final by2 = b.row + b.rowSpan;
  return a.col < bx2 && b.col < ax2 && a.row < by2 && b.row < ay2;
}

/// Whether [p] overlaps any placement in [others].
bool anyOverlap(Placement p, Iterable<Placement> others) =>
    others.any((o) => overlaps(p, o));
