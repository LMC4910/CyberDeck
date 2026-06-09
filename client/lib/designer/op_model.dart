/// Designer op builder (PROJ-211, 2C §4). The Designer constructs layout ops here
/// and sends them over the Layout channel to the engine, which is the authoritative
/// applier/versioner (`engine/core/layout`). The Designer also applies them
/// optimistically through the existing `LayoutInterpreter.applyOp` — so the JSON the
/// builder emits is exactly what both the engine op-log and the client renderer
/// (PROJ-181) consume.
library;

import '../render/render.dart';

/// Builds op JSON maps for a page, stamping the doc version the edit is based on.
class OpBuilder {
  OpBuilder({required this.pageId, this.docVersion = 0});

  /// The page these ops target.
  final String pageId;

  /// The document version this edit is based on (the engine rejects/resyncs on a
  /// version gap — PROJ-149/212).
  final int docVersion;

  Map<String, dynamic> _base(String op) =>
      {'op': op, 'pageId': pageId, 'docVersion': docVersion};

  /// AddWidget — add a widget to the page.
  Map<String, dynamic> addWidget(WidgetNode widget) =>
      _base('AddWidget')..['widget'] = _widgetJson(widget);

  /// RemoveWidget — remove a widget by id.
  Map<String, dynamic> removeWidget(String widgetId) =>
      _base('RemoveWidget')..['widgetId'] = widgetId;

  /// MoveWidget — move a widget to a new cell (span unchanged).
  Map<String, dynamic> moveWidget(String widgetId, {required int col, required int row}) =>
      _base('MoveWidget')
        ..['widgetId'] = widgetId
        ..['to'] = {'col': col, 'row': row};

  /// ResizeWidget — change a widget's span.
  Map<String, dynamic> resizeWidget(String widgetId, {required int colSpan, required int rowSpan}) =>
      _base('ResizeWidget')
        ..['widgetId'] = widgetId
        ..['to'] = {'colSpan': colSpan, 'rowSpan': rowSpan};

  /// SetStyle — replace a widget's appearance style.
  Map<String, dynamic> setStyle(String widgetId, Map<String, dynamic> style) =>
      _base('SetStyle')
        ..['widgetId'] = widgetId
        ..['style'] = style;

  /// SetBinding — set (or clear, when null) a widget's bound state.
  Map<String, dynamic> setBinding(String widgetId, String? stateBinding) {
    final op = _base('SetBinding')..['widgetId'] = widgetId;
    if (stateBinding != null) op['stateBinding'] = stateBinding;
    return op;
  }

  /// SetInteraction — replace a widget's interaction slots.
  Map<String, dynamic> setInteraction(String widgetId, Map<String, dynamic> interaction) =>
      _base('SetInteraction')
        ..['widgetId'] = widgetId
        ..['interaction'] = interaction;

  /// SetConfig — replace a widget's config.
  Map<String, dynamic> setConfig(String widgetId, Map<String, dynamic> config) =>
      _base('SetConfig')
        ..['widgetId'] = widgetId
        ..['config'] = config;

  /// ChangeGrid — change the page grid.
  Map<String, dynamic> changeGrid(Map<String, dynamic> grid) =>
      _base('ChangeGrid')..['grid'] = grid;

  /// AddPage — add a new page to the profile.
  Map<String, dynamic> addPage(String newPageId, {Map<String, dynamic>? grid}) =>
      _base('AddPage')
        ..['page'] = {
          'id': newPageId,
          'grid': ?grid,
          'widgets': <dynamic>[],
        };

  /// RemovePage — remove a page by id.
  Map<String, dynamic> removePage(String targetPageId) =>
      _base('RemovePage')..['pageId'] = targetPageId;

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
          'style': w.appearance.style,
          'stateBinding': ?w.appearance.stateBinding,
          if (w.appearance.valueRules.isNotEmpty)
            'valueRules': w.appearance.valueRules,
        },
        if (w.interaction.isNotEmpty) 'interaction': w.interaction,
        if (w.config.isNotEmpty) 'config': w.config,
      };
}
