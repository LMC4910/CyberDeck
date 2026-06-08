/// Layout document model (PROJ-181, TRD 2C §2/§3). The client is a deterministic
/// renderer of this host-authored document (ADR-0002/0003): a Page holds a
/// GridConfig and a list of Widgets, each separating appearance / interaction /
/// config (2C §3). These are parsed from the engine's JSON and never authored on
/// the client.
library;

/// Where a widget sits on the grid (no caps — ADR-0017).
class Placement {
  const Placement({
    required this.col,
    required this.row,
    this.colSpan = 1,
    this.rowSpan = 1,
  });

  final int col;
  final int row;
  final int colSpan;
  final int rowSpan;

  Placement copyWith({int? col, int? row, int? colSpan, int? rowSpan}) =>
      Placement(
        col: col ?? this.col,
        row: row ?? this.row,
        colSpan: colSpan ?? this.colSpan,
        rowSpan: rowSpan ?? this.rowSpan,
      );

  factory Placement.fromJson(Map<String, dynamic> m) => Placement(
        col: (m['col'] as num?)?.toInt() ?? 0,
        row: (m['row'] as num?)?.toInt() ?? 0,
        colSpan: (m['colSpan'] as num?)?.toInt() ?? 1,
        rowSpan: (m['rowSpan'] as num?)?.toInt() ?? 1,
      );
}

/// A widget's appearance: style, the state it follows, and client-side value rules.
class Appearance {
  const Appearance({
    this.style = const {},
    this.stateBinding,
    this.valueRules = const [],
  });

  final Map<String, dynamic> style;
  final String? stateBinding;
  final List<dynamic> valueRules;

  Appearance copyWith({
    Map<String, dynamic>? style,
    String? stateBinding,
    bool clearBinding = false,
    List<dynamic>? valueRules,
  }) =>
      Appearance(
        style: style ?? this.style,
        stateBinding: clearBinding ? null : (stateBinding ?? this.stateBinding),
        valueRules: valueRules ?? this.valueRules,
      );

  factory Appearance.fromJson(Map<String, dynamic>? m) => Appearance(
        style: (m?['style'] as Map?)?.cast<String, dynamic>() ?? const {},
        stateBinding: m?['stateBinding'] as String?,
        valueRules: (m?['valueRules'] as List?) ?? const [],
      );
}

/// One widget on a page: id + type (∈ widget registry) + placement + the three
/// independent concerns (appearance / interaction / config), per 2C §3.
class WidgetNode {
  const WidgetNode({
    required this.id,
    required this.type,
    required this.placement,
    this.appearance = const Appearance(),
    this.interaction = const {},
    this.config = const {},
  });

  final String id;
  final String type;
  final Placement placement;
  final Appearance appearance;
  final Map<String, dynamic> interaction;
  final Map<String, dynamic> config;

  WidgetNode copyWith({
    Placement? placement,
    Appearance? appearance,
    Map<String, dynamic>? interaction,
    Map<String, dynamic>? config,
  }) =>
      WidgetNode(
        id: id,
        type: type,
        placement: placement ?? this.placement,
        appearance: appearance ?? this.appearance,
        interaction: interaction ?? this.interaction,
        config: config ?? this.config,
      );

  factory WidgetNode.fromJson(Map<String, dynamic> m) => WidgetNode(
        id: m['id'] as String,
        type: m['type'] as String,
        placement:
            Placement.fromJson((m['placement'] as Map?)?.cast<String, dynamic>() ?? const {}),
        appearance:
            Appearance.fromJson((m['appearance'] as Map?)?.cast<String, dynamic>()),
        interaction:
            (m['interaction'] as Map?)?.cast<String, dynamic>() ?? const {},
        config: (m['config'] as Map?)?.cast<String, dynamic>() ?? const {},
      );
}

/// The page grid (2C §2.1). No column/row caps.
class GridConfig {
  const GridConfig({
    this.columns = 24,
    this.rows = 18,
    this.gutter = 8,
    this.marginX = 16,
    this.marginY = 16,
    this.background = const {},
    this.deviceClass,
  });

  final int columns;
  final int rows;
  final double gutter;
  final double marginX;
  final double marginY;
  final Map<String, dynamic> background;
  final String? deviceClass;

  factory GridConfig.fromJson(Map<String, dynamic>? m) => GridConfig(
        columns: (m?['columns'] as num?)?.toInt() ?? 24,
        rows: (m?['rows'] as num?)?.toInt() ?? 18,
        gutter: (m?['gutter'] as num?)?.toDouble() ?? 8,
        marginX: (m?['marginX'] as num?)?.toDouble() ?? 16,
        marginY: (m?['marginY'] as num?)?.toDouble() ?? 16,
        background: (m?['background'] as Map?)?.cast<String, dynamic>() ?? const {},
        deviceClass: m?['deviceClass'] as String?,
      );
}

/// A renderable page: grid + widgets + the document version it reflects (2C §4.2).
/// Named `LayoutPage` to avoid clashing with Flutter's Navigator `Page`.
class LayoutPage {
  const LayoutPage({
    required this.id,
    this.grid = const GridConfig(),
    this.widgets = const [],
    this.version = 0,
  });

  final String id;
  final GridConfig grid;
  final List<WidgetNode> widgets;
  final int version;

  factory LayoutPage.fromJson(Map<String, dynamic> m) => LayoutPage(
        id: m['id'] as String? ?? '',
        grid: GridConfig.fromJson((m['grid'] as Map?)?.cast<String, dynamic>()),
        widgets: ((m['widgets'] as List?) ?? const [])
            .map((w) => WidgetNode.fromJson((w as Map).cast<String, dynamic>()))
            .toList(),
        version: (m['version'] as num?)?.toInt() ?? 0,
      );
}
