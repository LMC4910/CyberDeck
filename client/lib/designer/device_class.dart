/// Device classes for the Designer (PROJ-210, 2C §2.2 / ADR-0017). A layout is
/// authored FOR a device class; the canvas renders at that class's grid + aspect so
/// "what you design is what that device shows". This is an interim set of presets —
/// the full device-class/grid config system is PROJ-217, which supersedes this.
library;

import '../render/model.dart';

/// A target device class: its grid dimensions + reference resolution (for aspect).
class DeviceClass {
  const DeviceClass({
    required this.id,
    required this.label,
    required this.columns,
    required this.rows,
    required this.refWidth,
    required this.refHeight,
  });

  final String id;
  final String label;
  final int columns;
  final int rows;
  final double refWidth;
  final double refHeight;

  /// The canvas aspect ratio (width / height) for this class.
  double get aspectRatio => refHeight == 0 ? 1 : refWidth / refHeight;

  /// A grid config for this class, preserving the given [gutter]/margins.
  GridConfig toGrid({double gutter = 8, double marginX = 16, double marginY = 16}) =>
      GridConfig(
        columns: columns,
        rows: rows,
        gutter: gutter,
        marginX: marginX,
        marginY: marginY,
        deviceClass: id,
      );

  /// The default device class.
  static const DeviceClass defaultClass = DeviceClass(
    id: 'tablet-landscape-10',
    label: '10" Tablet (landscape)',
    columns: 24,
    rows: 18,
    refWidth: 1280,
    refHeight: 800,
  );

  /// The built-in device-class presets (interim until PROJ-217).
  static const List<DeviceClass> presets = [
    defaultClass,
    DeviceClass(
      id: 'tablet-portrait-10',
      label: '10" Tablet (portrait)',
      columns: 18,
      rows: 24,
      refWidth: 800,
      refHeight: 1280,
    ),
    DeviceClass(
      id: 'phone-portrait',
      label: 'Phone (portrait)',
      columns: 8,
      rows: 16,
      refWidth: 720,
      refHeight: 1440,
    ),
  ];
}
