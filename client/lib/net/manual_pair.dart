/// Manual pairing entry (PROJ-148, 2A §2 / FR-2.2 fallback). When mDNS is blocked
/// and no QR is to hand, the user types the engine's address and a short PIN to
/// pair. This is the discovery fallback the spec requires: discovery is the happy
/// path, manual entry + active scan are the guaranteed alternatives.
///
/// A manual entry is just-enough information to run the SAME handshake the QR path
/// runs ([PairingClient]): a host (with optional port, defaulting to the engine's
/// advertised port), the PIN (carried as the pairing token), and the engine
/// fingerprint the user confirms out-of-band (typed / read off the engine screen).
/// The fingerprint is still verified at handshake (anti-MITM); typing it by hand
/// rather than scanning a QR does not weaken that check.
library;

import 'dart:async';

import 'connection_manager.dart';
import 'pairing.dart';

/// The engine's default LAN port (mirrors the engine's `DefaultServicePort`), used
/// when the user types a bare host with no `:port`.
const int kDefaultEnginePort = 47600;

/// Why parsing a manually-typed pairing entry failed.
enum ManualPairError {
  /// The host field was empty or not a usable host / IP.
  badHost,

  /// The `:port` was present but not a valid 1–65535 port number.
  badPort,

  /// The PIN was empty.
  badPin,

  /// The fingerprint was empty (no anti-MITM value to verify against).
  badFingerprint,
}

/// A manual-entry parse/validation failure with a categorised [error].
class ManualPairException implements Exception {
  ManualPairException(this.error, this.message);
  final ManualPairError error;
  final String message;
  @override
  String toString() => 'ManualPairException(${error.name}: $message)';
}

/// A validated manual pairing entry: where to dial, the PIN to authorize with, and
/// the fingerprint to verify. Build one with [ManualPairEntry.parse]; feed it to a
/// [ManualPairer] to run the handshake.
class ManualPairEntry {
  const ManualPairEntry({
    required this.host,
    required this.port,
    required this.pin,
    required this.fingerprint,
  });

  /// Resolved host or IP (no port).
  final String host;

  /// Resolved port (defaults to [kDefaultEnginePort] when the user omits `:port`).
  final int port;

  /// The pairing PIN, carried to the engine as the single-use pairing token.
  final String pin;

  /// The engine public-key fingerprint, confirmed out-of-band, verified at
  /// handshake.
  final String fingerprint;

  /// Parses raw user input into a validated entry.
  ///
  /// [address] is a host, optionally with a port: `192.168.1.50`,
  /// `192.168.1.50:47600`, or a bracketed IPv6 literal `[fe80::1]:47600`. Surrounding
  /// whitespace is trimmed. Throws [ManualPairException] with a precise [ManualPairError]
  /// so the entry UI can highlight the offending field.
  static ManualPairEntry parse({
    required String address,
    required String pin,
    required String fingerprint,
  }) {
    final (host, port) = _splitHostPort(address.trim());
    if (host.isEmpty) {
      throw ManualPairException(
          ManualPairError.badHost, 'a host or IP address is required');
    }
    final trimmedPin = pin.trim();
    if (trimmedPin.isEmpty) {
      throw ManualPairException(ManualPairError.badPin, 'a PIN is required');
    }
    final trimmedFp = fingerprint.trim();
    if (trimmedFp.isEmpty) {
      throw ManualPairException(ManualPairError.badFingerprint,
          'an engine fingerprint is required for anti-MITM verification');
    }
    return ManualPairEntry(
      host: host,
      port: port,
      pin: trimmedPin,
      fingerprint: trimmedFp,
    );
  }

  /// Splits `host`, `host:port`, or `[v6]:port` into (host, port). A missing port
  /// defaults to [kDefaultEnginePort]. A malformed port throws [ManualPairError.badPort].
  static (String, int) _splitHostPort(String address) {
    if (address.isEmpty) {
      return ('', kDefaultEnginePort);
    }
    // Bracketed IPv6 literal, optionally with a trailing :port.
    if (address.startsWith('[')) {
      final close = address.indexOf(']');
      if (close < 0) {
        throw ManualPairException(
            ManualPairError.badHost, 'unterminated IPv6 literal');
      }
      final host = address.substring(1, close);
      final rest = address.substring(close + 1);
      if (rest.isEmpty) {
        return (host, kDefaultEnginePort);
      }
      if (!rest.startsWith(':')) {
        throw ManualPairException(
            ManualPairError.badHost, 'unexpected text after IPv6 literal');
      }
      return (host, _parsePort(rest.substring(1)));
    }
    // A bare IPv6 literal (multiple colons, no brackets) has no port.
    final colons = ':'.allMatches(address).length;
    if (colons > 1) {
      return (address, kDefaultEnginePort);
    }
    if (colons == 1) {
      final i = address.indexOf(':');
      return (address.substring(0, i), _parsePort(address.substring(i + 1)));
    }
    return (address, kDefaultEnginePort);
  }

  static int _parsePort(String s) {
    final port = int.tryParse(s);
    if (port == null || port < 1 || port > 65535) {
      throw ManualPairException(
          ManualPairError.badPort, 'port must be a number in 1–65535');
    }
    return port;
  }
}

/// Runs the pairing handshake from a [ManualPairEntry] over a [ConnectionManager].
///
/// This is the thin bridge that turns typed-by-hand entry into the exact same
/// dial → handshake the QR path uses — the PIN becomes the pairing token and the
/// typed fingerprint is verified at handshake. Transient transport failures are
/// retried; a fingerprint mismatch / unauthorized PIN is terminal (not retried),
/// matching [ConnectionManager.connectWithRetry].
class ManualPairer {
  ManualPairer(this._cm);

  final ConnectionManager _cm;

  /// Dials the entry and pairs, returning the live [EngineConnection]. Throws a
  /// [PairingException] on a rejected PIN / fingerprint mismatch / unreachable host.
  Future<EngineConnection> pair(
    ManualPairEntry entry, {
    int maxAttempts = 4,
  }) {
    return _cm.connectWithRetry(
      host: entry.host,
      port: entry.port,
      token: entry.pin,
      expectedFingerprint: entry.fingerprint,
      maxAttempts: maxAttempts,
    );
  }
}
