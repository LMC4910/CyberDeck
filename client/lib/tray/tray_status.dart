/// Tray status model + mapping (PROJ-109). Reduces the engine's run-state (read over
/// the control channel) plus the health of the last control exchange into the small
/// set of states the tray surfaces: connected / degraded / error. Pure and platform-
/// free so it is fully unit-testable without the native tray plugin.
library;

/// What the tray icon/tooltip conveys about the engine.
///
///  * [connected] — the engine answered and is serving (running).
///  * [degraded]  — the engine answered but is not fully serving (e.g. paused), or a
///    transient state worth flagging without alarming the user.
///  * [error]     — the engine could not be reached / the control exchange failed.
enum TrayStatus { connected, degraded, error }

/// Maps an engine run-state label (the `state` of `service.status`, e.g. "running" /
/// "paused" / "starting") to a [TrayStatus].
///
/// The engine's labels are short, human-readable, and not a closed enum on the wire,
/// so we match leniently (case-insensitive, substring) and treat anything unknown as
/// [TrayStatus.degraded] — an unrecognised-but-present state is "reachable but not a
/// clean running", never silently "connected".
TrayStatus trayStatusForState(String state) {
  final s = state.trim().toLowerCase();
  if (s.isEmpty) return TrayStatus.error;
  if (s == 'running' || s == 'serving' || s == 'ready' || s == 'ok') {
    return TrayStatus.connected;
  }
  if (s.contains('error') || s.contains('fail') || s.contains('fatal')) {
    return TrayStatus.error;
  }
  // paused / pausing / resuming / starting / stopping / draining / unknown.
  return TrayStatus.degraded;
}

/// Maps a failed control exchange (dial/transport error) to [TrayStatus.error].
/// Kept as a named helper so call sites read intentionally and the contract is
/// asserted in tests.
TrayStatus trayStatusForUnreachable() => TrayStatus.error;

/// A human-readable summary the tray uses for its tooltip and the status menu line.
String trayStatusLabel(TrayStatus status, {String? detail}) {
  final base = switch (status) {
    TrayStatus.connected => 'Engine: connected',
    TrayStatus.degraded => 'Engine: degraded',
    TrayStatus.error => 'Engine: unreachable',
  };
  final d = detail?.trim() ?? '';
  return d.isEmpty ? base : '$base ($d)';
}
