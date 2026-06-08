/// Client connection manager (PROJ-180, 2A client): resolve a target (mDNS via
/// `discovery.dart`, or manual addr+token), dial, run the pairing handshake, and
/// hold the resulting encrypted session + channel router. Includes a bounded
/// retry/backoff for transient transport failures (PROJ-146 integration); genuine
/// rejections (fingerprint mismatch / unauthorized) are NOT retried.
library;

import 'dart:async';

import 'channels.dart';
import 'conn.dart';
import 'encrypted_session.dart';
import 'framing.dart';
import 'pairing.dart';

/// A live, paired connection to an engine.
class EngineConnection {
  EngineConnection({
    required this.session,
    required this.router,
    required this.engineUuid,
    required this.engineFingerprint,
    required this.defaultPermsJson,
  });

  final EncryptedSession session;
  final ChannelRouter router;
  final String engineUuid;
  final String engineFingerprint;
  final String defaultPermsJson;

  /// Tears the connection down.
  Future<void> close() async {
    await router.close();
    await session.close();
  }
}

/// Dials a target and yields a [FrameChannel]. Injectable so tests can supply an
/// in-memory pipe instead of a real socket.
typedef Dialer = Future<FrameChannel> Function(String host, int port);

/// Manages dialing + pairing to engines for one device identity.
class ConnectionManager {
  ConnectionManager({
    required this.identity,
    PairingClient? pairing,
    Dialer? dialer,
    Future<void> Function(Duration)? sleep,
  })  : _pairing = pairing ?? PairingClient(),
        _dialer = dialer ?? _socketDialer,
        _sleep = sleep ?? Future.delayed;

  final DeviceIdentity identity;
  final PairingClient _pairing;
  final Dialer _dialer;
  final Future<void> Function(Duration) _sleep;

  /// Dials host:port and runs the pairing handshake once.
  Future<EngineConnection> connect({
    required String host,
    required int port,
    required String token,
    required String expectedFingerprint,
  }) async {
    final frames = await _dialer(host, port);
    final outcome = await _pairing.pair(
      frames: frames,
      identity: identity,
      token: token,
      expectedFingerprint: expectedFingerprint,
    );
    return EngineConnection(
      session: outcome.session,
      router: ChannelRouter(outcome.session),
      engineUuid: outcome.engineUuid,
      engineFingerprint: outcome.engineFingerprint,
      defaultPermsJson: outcome.defaultPermsJson,
    );
  }

  /// Connects using a scanned/typed [PairingPayload], trying its candidate
  /// addresses in order.
  Future<EngineConnection> connectWithPayload(PairingPayload payload) async {
    Object? lastErr;
    for (final addr in payload.addresses) {
      try {
        return await connect(
          host: addr,
          port: payload.port,
          token: payload.token,
          expectedFingerprint: payload.fingerprint,
        );
      } on PairingException catch (e) {
        // A fingerprint mismatch / unauthorized is terminal — do not try more.
        if (e.failure == PairingFailure.fingerprintMismatch ||
            e.failure == PairingFailure.unauthorized) {
          rethrow;
        }
        lastErr = e;
      } catch (e) {
        lastErr = e; // transport error for this address; try the next
      }
    }
    throw PairingException(
        PairingFailure.protocol, 'no candidate address reachable: $lastErr');
  }

  /// Connects with bounded retry/backoff for transient transport failures.
  /// Terminal pairing rejections (fingerprint mismatch / unauthorized) are not
  /// retried.
  Future<EngineConnection> connectWithRetry({
    required String host,
    required int port,
    required String token,
    required String expectedFingerprint,
    int maxAttempts = 4,
    Duration baseBackoff = const Duration(milliseconds: 200),
  }) async {
    var attempt = 0;
    while (true) {
      attempt++;
      try {
        return await connect(
          host: host,
          port: port,
          token: token,
          expectedFingerprint: expectedFingerprint,
        );
      } on PairingException catch (e) {
        if (e.failure == PairingFailure.fingerprintMismatch ||
            e.failure == PairingFailure.unauthorized ||
            attempt >= maxAttempts) {
          rethrow;
        }
      } catch (_) {
        if (attempt >= maxAttempts) rethrow;
      }
      await _sleep(baseBackoff * attempt); // linear backoff
    }
  }

  static Future<FrameChannel> _socketDialer(String host, int port) async {
    final conn = await SocketConn.connect(host, port);
    return FrameChannel(conn);
  }
}
