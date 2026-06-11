/// Deck editor (Designer): a touch + pointer WYSIWYG editor over the live renderer.
/// Select a widget, drag it on the grid (snap + no-overlap, via DesignerController),
/// edit its config in the schema-driven Inspector, rename it, add or remove widgets.
/// Edits apply live through LayoutInterpreter.applyOp and are saved back to the
/// DeckSource on exit (Demo Mode persists for the session).
library;

import 'package:flutter/material.dart';

import '../data/deck_source.dart';
import '../render/render.dart';
import 'canvas.dart';
import 'inspector/inspector.dart';
import 'inspector/param_schema.dart';
import 'op_model.dart';

class DeckEditor extends StatefulWidget {
  const DeckEditor({super.key, required this.source, required this.deckId});

  final DeckSource source;
  final String deckId;

  @override
  State<DeckEditor> createState() => _DeckEditorState();
}

class _DeckEditorState extends State<DeckEditor> {
  late LayoutInterpreter _interp;
  late DesignerController _controller;
  late OpBuilder _ops;
  String? _selectedId;

  // drag bookkeeping (cell-delta from the drag start, so we never need canvas-local
  // coordinates — robust on touch + pointer).
  int _startCol = 0;
  int _startRow = 0;
  Offset _accum = Offset.zero;

  @override
  void initState() {
    super.initState();
    _interp = LayoutInterpreter(registry: RendererRegistry.withBuiltins())
      ..load(widget.source.layout(widget.deckId));
    _controller = DesignerController(_interp);
    _ops = OpBuilder(pageId: widget.deckId);
  }

  void _apply(Map<String, dynamic> op) {
    _interp.applyOp(LayoutOp.fromJson(op));
    setState(() {});
  }

  void _save() {
    widget.source.saveDeck(
      widget.deckId,
      LayoutPage(
        id: widget.deckId,
        grid: _interp.grid,
        widgets: [
          for (final id in _interp.widgetIds) _interp.nodeListenable(id).value,
        ],
      ),
    );
    Navigator.of(context).pop();
  }

  void _removeSelected() {
    final id = _selectedId;
    if (id == null) return;
    _interp.applyOp(LayoutOp.fromJson(_ops.removeWidget(id)));
    setState(() => _selectedId = null);
  }

  Future<void> _addWidget() async {
    final type = await showModalBottomSheet<String>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final e in const {
              'button': 'Button',
              'toggle': 'Toggle',
              'label': 'Label',
              'gauge.circular': 'Gauge (circular)',
              'gauge.linear': 'Gauge (bar)',
              'slider': 'Slider',
            }.entries)
              ListTile(
                key: Key('add-${e.key}'),
                leading: const Icon(Icons.add_box_outlined),
                title: Text(e.value),
                onTap: () => Navigator.of(context).pop(e.key),
              ),
          ],
        ),
      ),
    );
    if (type == null) return;
    _placeNew(type);
  }

  void _placeNew(String type) {
    final id = 'w${DateTime.now().microsecondsSinceEpoch}';
    final binding = switch (type) {
      'gauge.circular' || 'gauge.linear' => 'sys.cpu',
      'slider' => 'media.volume',
      _ => null,
    };
    final node = WidgetNode(
      id: id,
      type: type,
      placement: const Placement(col: 0, row: 0, colSpan: 2, rowSpan: 2),
      appearance: Appearance(style: {'label': _defaultLabel(type)}, stateBinding: binding),
      interaction: (type == 'button' || type == 'toggle')
          ? {
              'tap': {'target': 'action', 'ref': 'mock.noop'}
            }
          : const {},
      config: (type.startsWith('gauge') || type == 'slider')
          ? {'min': 0.0, 'max': 100.0, 'unit': ''}
          : const {},
    );
    // Find the first free cell (DesignerController.tryAdd rejects overlaps).
    for (var r = 0; r < _interp.grid.rows; r++) {
      for (var c = 0; c < _interp.grid.columns - 1; c++) {
        final placed = node.copyWith(placement: node.placement.copyWith(col: c, row: r));
        if (_controller.tryAdd(placed)) {
          setState(() => _selectedId = id);
          return;
        }
      }
    }
    ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No room — remove a widget first')));
  }

  String _defaultLabel(String type) => switch (type) {
        'button' => 'Button',
        'toggle' => 'Toggle',
        'label' => 'Label',
        _ => '',
      };

  @override
  void dispose() {
    _interp.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E14),
      appBar: AppBar(
        title: const Text('Edit deck'),
        actions: [
          IconButton(
            key: const Key('editor-add'),
            icon: const Icon(Icons.add),
            tooltip: 'Add widget',
            onPressed: _addWidget,
          ),
          IconButton(
            key: const Key('editor-save'),
            icon: const Icon(Icons.check),
            tooltip: 'Save',
            onPressed: _save,
          ),
        ],
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, c) {
            final wide = c.maxWidth >= 720;
            final canvas = _buildCanvas();
            final panel = _buildPanel();
            return wide
                ? Row(children: [
                    Expanded(child: canvas),
                    SizedBox(width: 320, child: panel),
                  ])
                : Column(children: [
                    Expanded(child: canvas),
                    SizedBox(height: 260, child: panel),
                  ]);
          },
        ),
      ),
    );
  }

  Widget _buildCanvas() {
    return ValueListenableBuilder<int>(
      valueListenable: _interp.structure,
      builder: (context, _, _) => LayoutBuilder(
        builder: (context, c) {
          final grid = _interp.grid;
          final cellW = grid.cellWidth(c.maxWidth);
          final cellH = grid.cellHeight(c.maxHeight);
          return Stack(children: [
            Positioned.fill(
              child: CustomPaint(painter: _GridPainter(grid)),
            ),
            Positioned.fill(child: _interp.build()),
            // Transparent hit-boxes for select + drag, matching the renderer geometry.
            for (final id in _interp.widgetIds)
              _hitBox(id, grid, cellW, cellH),
          ]);
        },
      ),
    );
  }

  Widget _hitBox(String id, GridConfig grid, double cellW, double cellH) {
    final p = _interp.nodeListenable(id).value.placement;
    final selected = id == _selectedId;
    return Positioned(
      left: grid.marginX + p.col * (cellW + grid.gutter),
      top: grid.marginY + p.row * (cellH + grid.gutter),
      width: p.colSpan * cellW + (p.colSpan - 1) * grid.gutter,
      height: p.rowSpan * cellH + (p.rowSpan - 1) * grid.gutter,
      child: GestureDetector(
        key: Key('edit-hit-$id'),
        behavior: HitTestBehavior.opaque,
        onTap: () => setState(() => _selectedId = id),
        onPanStart: (_) {
          final node = _interp.nodeListenable(id).value;
          _selectedId = id;
          _startCol = node.placement.col;
          _startRow = node.placement.row;
          _accum = Offset.zero;
        },
        onPanUpdate: (d) {
          _accum += d.delta;
          final dc = (_accum.dx / (cellW + grid.gutter)).round();
          final dr = (_accum.dy / (cellH + grid.gutter)).round();
          _controller.tryMove(id, _startCol + dc, _startRow + dr);
          setState(() {});
        },
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: Border.all(
              color: selected ? const Color(0xFF00E5FF) : Colors.transparent,
              width: 2,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPanel() {
    final id = _selectedId;
    if (id == null || !_interp.widgetIds.contains(id)) {
      return Container(
        color: const Color(0xFF0E1722),
        padding: const EdgeInsets.all(16),
        alignment: Alignment.center,
        child: const Text('Select a widget to edit, or add one (＋).',
            key: Key('editor-hint'), textAlign: TextAlign.center),
      );
    }
    final node = _interp.nodeListenable(id).value;
    return DecoratedBox(
      decoration: const BoxDecoration(color: Color(0xFF0E1722)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              Expanded(
                child: Text('${node.type}  ·  ${node.id}',
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
              ),
              IconButton(
                key: const Key('editor-remove'),
                icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                tooltip: 'Remove',
                onPressed: _removeSelected,
              ),
            ]),
            const SizedBox(height: 8),
            TextFormField(
              key: ValueKey('editor-label-$id'),
              initialValue: node.appearance.style['label'] as String? ?? '',
              decoration: const InputDecoration(labelText: 'Label'),
              onFieldSubmitted: (v) =>
                  _apply(_ops.setStyle(id, {...node.appearance.style, 'label': v})),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: Inspector(
                widget: node,
                schema: _schemaFor(node),
                opBuilder: _ops,
                onCommit: _apply,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Synthesize an inspector schema from the widget's current config (Demo Mode has
  // no registry; types are inferred from the values).
  List<ParamSchema> _schemaFor(WidgetNode n) => [
        for (final e in n.config.entries)
          ParamSchema(name: e.key, type: _inferType(e.value), defaultValue: e.value),
      ];

  ParamType _inferType(Object? v) => switch (v) {
        bool _ => ParamType.boolean,
        num _ => ParamType.number,
        _ => ParamType.text,
      };
}

class _GridPainter extends CustomPainter {
  _GridPainter(this.grid);
  final GridConfig grid;

  @override
  void paint(Canvas canvas, Size size) {
    final cellW = grid.cellWidth(size.width);
    final cellH = grid.cellHeight(size.height);
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.06)
      ..strokeWidth = 1;
    for (var col = 0; col <= grid.columns; col++) {
      final x = grid.marginX + col * (cellW + grid.gutter) - grid.gutter / 2;
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
  bool shouldRepaint(_GridPainter old) =>
      old.grid.columns != grid.columns || old.grid.rows != grid.rows;
}
