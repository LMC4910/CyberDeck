/// Tray menu model + action dispatch (PROJ-109), decoupled from the native tray
/// plugin so the menu shape and what each action does are unit-testable without a
/// real system tray. [TrayPresence] (desktop-only) renders these via tray_manager.
library;

import 'dart:async';

import 'tray_control_client.dart';
import 'tray_status.dart';

/// The privileged actions the tray exposes (2A §6).
///
///  * [reopenUi]   — bring the (possibly hidden) UI window back to front. Purely a
///    UI-side action; it does not touch the control channel.
///  * [pauseEngine]   — `service.pause` over the control channel.
///  * [quitEngine]    — `service.quit` over the control channel.
///  * [showPairingQr] — mint a single-use pairing token (`pair.approve`) and surface
///    it as a QR for a phone to scan.
enum TrayAction { reopenUi, pauseEngine, quitEngine, showPairingQr }

/// The stable menu-item key used on the wire to the native tray (and in tests).
String trayActionKey(TrayAction a) => switch (a) {
      TrayAction.reopenUi => 'reopen_ui',
      TrayAction.pauseEngine => 'pause_engine',
      TrayAction.quitEngine => 'quit_engine',
      TrayAction.showPairingQr => 'show_pairing_qr',
    };

/// Resolves a native menu-item key back to a [TrayAction], or null if unknown.
TrayAction? trayActionForKey(String key) {
  for (final a in TrayAction.values) {
    if (trayActionKey(a) == key) return a;
  }
  return null;
}

/// The label shown for an action in the tray menu.
String trayActionLabel(TrayAction a) => switch (a) {
      TrayAction.reopenUi => 'Reopen UI',
      TrayAction.pauseEngine => 'Pause Engine',
      TrayAction.quitEngine => 'Quit Engine',
      TrayAction.showPairingQr => 'Show Pairing QR',
    };

/// One entry in the tray menu (an actionable item or a separator).
class TrayMenuEntry {
  const TrayMenuEntry.action(this.action, {this.enabled = true})
      : isSeparator = false,
        label = null;
  const TrayMenuEntry.label(this.label)
      : isSeparator = false,
        action = null,
        enabled = false;
  const TrayMenuEntry.separator()
      : isSeparator = true,
        action = null,
        label = null,
        enabled = false;

  /// True for a divider line (no action, no label).
  final bool isSeparator;

  /// The action this entry triggers, or null for a label/separator.
  final TrayAction? action;

  /// A non-interactive header line (the status summary), or null.
  final String? label;

  /// Whether an action entry is clickable.
  final bool enabled;
}

/// Builds the tray menu for a given engine [status]. The status summary is a
/// disabled header line; Pause is disabled when the engine is unreachable (there is
/// nothing to pause/talk to). Quit / Reopen / Pairing-QR remain available so the user
/// can always recover or tear down.
List<TrayMenuEntry> buildTrayMenu(TrayStatus status, {String? detail}) {
  final reachable = status != TrayStatus.error;
  return [
    TrayMenuEntry.label(trayStatusLabel(status, detail: detail)),
    const TrayMenuEntry.separator(),
    const TrayMenuEntry.action(TrayAction.reopenUi),
    TrayMenuEntry.action(TrayAction.showPairingQr, enabled: reachable),
    TrayMenuEntry.action(TrayAction.pauseEngine, enabled: reachable),
    const TrayMenuEntry.separator(),
    const TrayMenuEntry.action(TrayAction.quitEngine),
  ];
}

/// The outcome of dispatching a tray action: success/failure plus any data the UI
/// needs (e.g. a minted pairing token for the QR action).
class TrayActionResult {
  const TrayActionResult.ok({this.token}) : success = true, message = '';
  const TrayActionResult.failure(this.message) : success = false, token = null;

  final bool success;
  final String message;

  /// The single-use pairing token, set only for a successful Show Pairing QR.
  final String? token;
}

/// Called when the UI window should be brought back to front (Reopen UI).
typedef ReopenUiCallback = FutureOr<void> Function();

/// Dispatches tray actions to the engine over the control channel (or to the UI for
/// [TrayAction.reopenUi]). Kept free of any native-tray dependency so the mapping
/// from action → control op is directly testable with a fake [TrayControlClient].
class TrayActionDispatcher {
  TrayActionDispatcher({
    required TrayControlClient control,
    required ReopenUiCallback onReopenUi,
  })  : _control = control,
        _onReopenUi = onReopenUi;

  final TrayControlClient _control;
  final ReopenUiCallback _onReopenUi;

  /// Runs [action], never throwing — a control/transport failure is reported as a
  /// failed [TrayActionResult] for user feedback.
  Future<TrayActionResult> dispatch(TrayAction action) async {
    try {
      switch (action) {
        case TrayAction.reopenUi:
          await _onReopenUi();
          return const TrayActionResult.ok();
        case TrayAction.pauseEngine:
          await _control.pause();
          return const TrayActionResult.ok();
        case TrayAction.quitEngine:
          await _control.quit();
          return const TrayActionResult.ok();
        case TrayAction.showPairingQr:
          final token = await _control.approvePairing();
          return TrayActionResult.ok(token: token);
      }
    } on ControlChannelException catch (e) {
      return TrayActionResult.failure(e.message);
    } catch (e) {
      return TrayActionResult.failure('$e');
    }
  }
}
