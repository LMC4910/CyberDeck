/// System-tray presence (PROJ-109). Desktop-only: a tray icon + tooltip that reflect
/// the engine run-state (connected / degraded / error) and a context menu whose
/// actions — Reopen UI, Pause Engine, Quit Engine, Show Pairing QR — drive the engine
/// over the loopback control channel (PROJ-144).
///
/// Guarding: the whole presence is inert on web and mobile. [TrayPresence.isSupported]
/// gates construction, and every native call is behind it, so a mobile build neither
/// invokes nor depends on the tray at runtime. The status mapping
/// ([tray_status.dart]), menu model + action dispatch ([tray_menu.dart]), and control
/// client ([tray_control_client.dart]) are platform-free and unit-tested directly.
library;

import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:tray_manager/tray_manager.dart';

import 'tray_control_client.dart';
import 'tray_menu.dart';
import 'tray_status.dart';

/// How the QR-token result of Show Pairing QR is surfaced to the user (the app shows
/// it as a scannable QR / copyable string). Kept as a callback so this file stays
/// free of UI concerns.
typedef ShowPairingTokenCallback = FutureOr<void> Function(String token);

/// How an action failure is surfaced (e.g. a snackbar / dialog).
typedef TrayErrorCallback = FutureOr<void> Function(String message);

/// Owns the desktop system-tray icon, tooltip, and context menu, and bridges native
/// menu clicks to the [TrayActionDispatcher].
class TrayPresence with TrayListener {
  TrayPresence({
    required TrayControlClient control,
    required ReopenUiCallback onReopenUi,
    required ShowPairingTokenCallback onPairingToken,
    TrayErrorCallback? onError,
    TrayManager? manager,
    String? iconPath,
  })  : _dispatcher = TrayActionDispatcher(
          control: control,
          onReopenUi: onReopenUi,
        ),
        _onPairingToken = onPairingToken,
        _onError = onError,
        _manager = manager ?? trayManager,
        _iconPath = iconPath ?? _defaultIconPath;

  final TrayActionDispatcher _dispatcher;
  final ShowPairingTokenCallback _onPairingToken;
  final TrayErrorCallback? _onError;
  final TrayManager _manager;
  final String _iconPath;

  TrayStatus _status = TrayStatus.error;
  bool _started = false;

  /// Whether a system tray is available on this platform (desktop, non-web).
  static bool get isSupported =>
      !kIsWeb && (Platform.isWindows || Platform.isLinux || Platform.isMacOS);

  /// The current status reflected in the tray (defaults to error until the first
  /// [refresh]).
  TrayStatus get status => _status;

  // tray_manager ships per-platform icon conventions: an .ico on Windows, a template
  // .png elsewhere. The asset is added under client assets in a follow-up; the path
  // is centralised here so wiring can override it.
  static String get _defaultIconPath =>
      Platform.isWindows ? 'assets/tray/icon.ico' : 'assets/tray/icon.png';

  /// Installs the tray icon + listener and renders the initial menu. No-op (and not
  /// an error) on unsupported platforms, so callers can invoke it unconditionally.
  Future<void> start() async {
    if (!isSupported || _started) return;
    _started = true;
    _manager.addListener(this);
    await _manager.setIcon(_iconPath);
    await _applyStatus(_status, detail: 'starting');
  }

  /// Removes the tray icon + listener.
  Future<void> dispose() async {
    if (!isSupported || !_started) return;
    _started = false;
    _manager.removeListener(this);
    await _manager.destroy();
  }

  /// Polls the engine run-state once and updates the icon/tooltip/menu. Never throws
  /// — an unreachable engine maps to [TrayStatus.error]. Returns the resolved status.
  Future<TrayStatus> refresh(TrayControlClient control) async {
    TrayStatus next;
    String? detail;
    try {
      final state = await control.status();
      next = trayStatusForState(state);
      detail = state;
    } on ControlChannelException {
      next = trayStatusForUnreachable();
    } catch (_) {
      next = trayStatusForUnreachable();
    }
    await _applyStatus(next, detail: detail);
    return next;
  }

  Future<void> _applyStatus(TrayStatus status, {String? detail}) async {
    _status = status;
    if (!isSupported || !_started) return;
    await _manager.setToolTip(trayStatusLabel(status, detail: detail));
    await _manager.setContextMenu(_menuFor(status, detail));
  }

  Menu _menuFor(TrayStatus status, String? detail) {
    final items = <MenuItem>[];
    for (final e in buildTrayMenu(status, detail: detail)) {
      if (e.isSeparator) {
        items.add(MenuItem.separator());
      } else if (e.label != null) {
        items.add(MenuItem(label: e.label!, disabled: true));
      } else {
        final action = e.action!;
        items.add(MenuItem(
          key: trayActionKey(action),
          label: trayActionLabel(action),
          disabled: !e.enabled,
        ));
      }
    }
    return Menu(items: items);
  }

  // --- TrayListener -------------------------------------------------------------

  @override
  void onTrayIconMouseDown() {
    // Left-click reopens the UI — the common desktop affordance.
    unawaited(_dispatcher.dispatch(TrayAction.reopenUi));
  }

  @override
  void onTrayIconRightMouseDown() {
    unawaited(_manager.popUpContextMenu());
  }

  @override
  void onTrayMenuItemClick(MenuItem menuItem) {
    final key = menuItem.key;
    if (key == null) return;
    final action = trayActionForKey(key);
    if (action == null) return;
    unawaited(_handleAction(action));
  }

  Future<void> _handleAction(TrayAction action) async {
    final result = await _dispatcher.dispatch(action);
    if (!result.success) {
      await _onError?.call(result.message);
      return;
    }
    if (action == TrayAction.showPairingQr && result.token != null) {
      await _onPairingToken(result.token!);
    }
  }
}
