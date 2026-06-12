/// Designer undo/redo (PROJ-215, 2C §4 / ADR-0012). Every Designer edit is a
/// reversible op (the same ops the engine op-log inverts — see
/// `engine/core/layout/undo.go`). This file mirrors that on the client so a desktop
/// edit can be undone/redone locally and live: the inverse is computed from the tree
/// state BEFORE the op is applied, then both undo and redo flow back through the
/// SAME apply path the Designer already uses (`LayoutInterpreter.applyOp` +
/// broadcast), so the device sees an undo exactly like any other edit.
///
/// Usage: wrap each edit in [record] (it captures the inverse, applies the op via the
/// injected sink, and pushes onto the undo stack), then call [undo]/[redo].
library;

import '../render/render.dart';

/// Applies an op map to the live tree (and, when wired, broadcasts it). Returns
/// nothing — the same `_apply` the DeckEditor already uses.
typedef OpSink = void Function(Map<String, dynamic> op);

/// One reversible edit: the op that was applied + the inverse that reverses it.
class _Step {
  _Step(this.op, this.inverse);
  final Map<String, dynamic> op;
  final Map<String, dynamic> inverse;
}

/// Undo/redo stacks for the Designer, driven through an [OpSink]. A fresh edit
/// clears the redo branch (linear history); undo applies the inverse and moves the
/// step to redo; redo re-applies the op and moves it back to undo.
class UndoStack {
  UndoStack({required this.interpreter, required this.sink});

  /// The tree whose pre-state inverses are computed from.
  final LayoutInterpreter interpreter;

  /// Where ops (and their inverses) are applied — the existing apply+broadcast path.
  final OpSink sink;

  final List<_Step> _undo = [];
  final List<_Step> _redo = [];

  bool get canUndo => _undo.isNotEmpty;
  bool get canRedo => _redo.isNotEmpty;

  /// Records and applies a fresh edit: computes its inverse from the current tree,
  /// applies the op, pushes the (op, inverse) pair, and clears the redo branch.
  void record(Map<String, dynamic> op) {
    final inverse = invert(op);
    sink(op);
    _undo.add(_Step(op, inverse));
    _redo.clear();
  }

  /// Records an already-applied edit whose [inverse] was captured externally — used
  /// by interactions (like a drag) that mutate the tree live for feedback, then want
  /// the whole gesture to undo as a single step. The op is NOT re-applied (it is
  /// already in effect); only history is updated, clearing the redo branch.
  void recordApplied(Map<String, dynamic> op, Map<String, dynamic> inverse) {
    _undo.add(_Step(op, inverse));
    _redo.clear();
  }

  /// Reverses the most recent edit by applying its inverse through the sink. The
  /// step moves intact to the redo stack: applying `op` again re-does it, and
  /// `inverse` reverses it again, so the (op, inverse) pair is stable across any
  /// number of undo/redo cycles. No-op when nothing to undo.
  void undo() {
    if (_undo.isEmpty) return;
    final step = _undo.removeLast();
    sink(step.inverse);
    _redo.add(step);
  }

  /// Re-applies the most recently undone edit through the sink. The step moves back
  /// to the undo stack intact. No-op when nothing to redo.
  void redo() {
    if (_redo.isEmpty) return;
    final step = _redo.removeLast();
    sink(step.op);
    _undo.add(step);
  }

  /// Clears both stacks (e.g. after a load / resync — history does not survive a
  /// document reload).
  void clear() {
    _undo.clear();
    _redo.clear();
  }

  /// Computes the inverse of [op] against the CURRENT interpreter state — the same
  /// inverse the engine's `Profile.Apply` returns (it must agree, since both sides
  /// apply the identical op JSON). Pure given the tree; call BEFORE applying [op].
  Map<String, dynamic> invert(Map<String, dynamic> op) {
    final kind = op['op'] as String?;
    final id = op['widgetId'] as String?;
    switch (kind) {
      case 'AddWidget':
        final w = (op['widget'] as Map).cast<String, dynamic>();
        return {'op': 'RemoveWidget', 'widgetId': w['id']};
      case 'RemoveWidget':
        // Inverse re-adds the widget exactly as it is now.
        return {'op': 'AddWidget', 'widget': _widgetJson(_node(id!))};
      case 'MoveWidget':
        final p = _node(id!).placement;
        return {
          'op': 'MoveWidget',
          'widgetId': id,
          'to': {'col': p.col, 'row': p.row},
        };
      case 'ResizeWidget':
        final p = _node(id!).placement;
        return {
          'op': 'ResizeWidget',
          'widgetId': id,
          'to': {'colSpan': p.colSpan, 'rowSpan': p.rowSpan},
        };
      case 'SetStyle':
        return {
          'op': 'SetStyle',
          'widgetId': id,
          'style': Map<String, dynamic>.from(_node(id!).appearance.style),
        };
      case 'SetBinding':
        final prev = _node(id!).appearance.stateBinding;
        final inv = <String, dynamic>{'op': 'SetBinding', 'widgetId': id};
        if (prev != null) inv['stateBinding'] = prev;
        return inv;
      case 'SetInteraction':
        return {
          'op': 'SetInteraction',
          'widgetId': id,
          'interaction': Map<String, dynamic>.from(_node(id!).interaction),
        };
      case 'SetConfig':
        return {
          'op': 'SetConfig',
          'widgetId': id,
          'config': Map<String, dynamic>.from(_node(id!).config),
        };
      case 'ChangeGrid':
        return {'op': 'ChangeGrid', 'grid': _gridJson(interpreter.grid)};
      default:
        throw ArgumentError('cannot invert op: $kind');
    }
  }

  WidgetNode _node(String id) => interpreter.nodeListenable(id).value;

  static Map<String, dynamic> _widgetJson(WidgetNode w) => {
        'id': w.id,
        'type': w.type,
        'placement': {
          'col': w.placement.col,
          'row': w.placement.row,
          'colSpan': w.placement.colSpan,
          'rowSpan': w.placement.rowSpan,
        },
        'appearance': {
          'style': Map<String, dynamic>.from(w.appearance.style),
          if (w.appearance.stateBinding != null)
            'stateBinding': w.appearance.stateBinding,
        },
        if (w.interaction.isNotEmpty)
          'interaction': Map<String, dynamic>.from(w.interaction),
        if (w.config.isNotEmpty) 'config': Map<String, dynamic>.from(w.config),
      };

  static Map<String, dynamic> _gridJson(GridConfig g) => {
        'columns': g.columns,
        'rows': g.rows,
        'gutter': g.gutter,
        'marginX': g.marginX,
        'marginY': g.marginY,
        if (g.background.isNotEmpty) 'background': g.background,
        if (g.deviceClass != null) 'deviceClass': g.deviceClass,
      };
}
