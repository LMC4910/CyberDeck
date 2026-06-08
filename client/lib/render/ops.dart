/// Layout operations (PROJ-181, 2C §4). Every edit is a versioned op applied to
/// the authoritative document held by the engine; the client applies the same ops
/// to its local tree and repaints only the affected nodes (2C §7.2). A version gap
/// triggers a full resync (handled by the connection layer, PROJ-149), never a
/// gap replay.
library;

import 'model.dart';

/// The V1 operation kinds the renderer applies. (Page/profile-level ops —
/// AddPage/RemovePage/AddProfile/SetProfileActivation — are handled above the
/// single-page interpreter.)
enum OpKind {
  addWidget,
  removeWidget,
  moveWidget,
  resizeWidget,
  setStyle,
  setBinding,
  setInteraction,
  setConfig,
  changeGrid,
  unknown,
}

/// A parsed layout operation.
class LayoutOp {
  const LayoutOp({
    required this.kind,
    required this.raw,
    this.widgetId,
    this.docVersion,
  });

  final OpKind kind;
  final String? widgetId;
  final int? docVersion;
  final Map<String, dynamic> raw;

  /// Whether this op changes which widgets exist / the grid (vs. a single widget).
  bool get isStructural =>
      kind == OpKind.addWidget ||
      kind == OpKind.removeWidget ||
      kind == OpKind.changeGrid;

  factory LayoutOp.fromJson(Map<String, dynamic> m) => LayoutOp(
        kind: _kindFromWire(m['op'] as String?),
        widgetId: m['widgetId'] as String?,
        docVersion: (m['docVersion'] as num?)?.toInt(),
        raw: m,
      );

  /// The new widget for an AddWidget op.
  WidgetNode widgetPayload() =>
      WidgetNode.fromJson((raw['widget'] as Map).cast<String, dynamic>());

  static OpKind _kindFromWire(String? op) {
    switch (op) {
      case 'AddWidget':
        return OpKind.addWidget;
      case 'RemoveWidget':
        return OpKind.removeWidget;
      case 'MoveWidget':
        return OpKind.moveWidget;
      case 'ResizeWidget':
        return OpKind.resizeWidget;
      case 'SetStyle':
        return OpKind.setStyle;
      case 'SetBinding':
        return OpKind.setBinding;
      case 'SetInteraction':
        return OpKind.setInteraction;
      case 'SetConfig':
        return OpKind.setConfig;
      case 'ChangeGrid':
        return OpKind.changeGrid;
      default:
        return OpKind.unknown;
    }
  }
}
