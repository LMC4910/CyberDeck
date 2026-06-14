/// Pairing UI (PROJ-180): lists mDNS-discovered engines, scans a QR (camera on
/// mobile, manual entry on desktop), runs the handshake via [ConnectionManager],
/// verifies the engine fingerprint, and surfaces clear errors for a fingerprint
/// mismatch or a bad/expired token (AC P1-AC-02).
library;

import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../net/connection_manager.dart';
import '../net/discovery.dart';
import '../net/pairing.dart';

/// Obtains a pairing payload string from the user (a scanned/typed QR).
abstract class QrScanner {
  /// Returns the raw QR/payload string, or null if cancelled.
  Future<String?> scan(BuildContext context);
}

/// Picks the platform-appropriate scanner: camera on mobile, manual entry on
/// desktop (where camera QR plugins aren't available).
QrScanner defaultQrScanner() {
  if (Platform.isAndroid || Platform.isIOS) {
    return const CameraQrScanner();
  }
  return const ManualQrEntry();
}

/// Camera-based QR scanner (mobile) using package:mobile_scanner.
class CameraQrScanner implements QrScanner {
  const CameraQrScanner();

  @override
  Future<String?> scan(BuildContext context) {
    return Navigator.of(context).push<String>(
      MaterialPageRoute<String>(builder: (_) => const _CameraScanPage()),
    );
  }
}

class _CameraScanPage extends StatelessWidget {
  const _CameraScanPage();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan pairing QR'),
        actions: [
          // Always-available fallback (and the escape hatch if the camera is
          // blocked): type/paste the pairing payload instead of scanning.
          IconButton(
            key: const Key('scan-manual'),
            icon: const Icon(Icons.keyboard),
            tooltip: 'Enter payload manually',
            onPressed: () => _manual(context),
          ),
        ],
      ),
      body: MobileScanner(
        onDetect: (capture) {
          if (capture.barcodes.isEmpty) return;
          final raw = capture.barcodes.first.rawValue;
          if (raw != null) Navigator.of(context).pop(raw);
        },
        // Without this, a denied/unavailable camera shows a blank screen. Surface
        // the reason + the manual-entry fallback so pairing never dead-ends.
        errorBuilder: (context, error, child) => _CameraError(
          message: _describe(error),
          onManual: () => _manual(context),
        ),
      ),
    );
  }

  /// Opens manual payload entry; pops the scan page with the result when given.
  Future<void> _manual(BuildContext context) async {
    final value = await const ManualQrEntry().scan(context);
    if (value != null && value.isNotEmpty && context.mounted) {
      Navigator.of(context).pop(value);
    }
  }

  static String _describe(MobileScannerException error) {
    if (error.errorCode == MobileScannerErrorCode.permissionDenied) {
      return 'Camera access is denied. Enable the Camera permission for CyberDeck '
          'in Settings, or enter the pairing payload manually.';
    }
    return 'The camera is unavailable on this device. Enter the pairing payload '
        'manually instead.';
  }
}

/// Shown when the camera cannot start (permission denied / no camera): explains
/// why and offers the manual-entry fallback so pairing still works.
class _CameraError extends StatelessWidget {
  const _CameraError({required this.message, required this.onManual});

  final String message;
  final VoidCallback onManual;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.no_photography_outlined, size: 48),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 24),
            FilledButton.icon(
              key: const Key('scan-error-manual'),
              onPressed: onManual,
              icon: const Icon(Icons.keyboard),
              label: const Text('Enter payload manually'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Manual payload entry (desktop): paste the QR's JSON payload.
class ManualQrEntry implements QrScanner {
  const ManualQrEntry();

  @override
  Future<String?> scan(BuildContext context) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Enter pairing payload'),
        content: TextField(
          controller: controller,
          maxLines: 4,
          decoration: const InputDecoration(
            hintText: '{"addresses":[...],"port":...,"token":"...","fp":"..."}',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
            child: const Text('Pair'),
          ),
        ],
      ),
    );
  }
}

/// The pairing screen. Dependencies are injected so tests can drive it with fakes.
class PairingScreen extends StatefulWidget {
  const PairingScreen({
    super.key,
    required this.discovery,
    required this.connectionManager,
    required this.scanner,
    this.onConnected,
  });

  final EngineDiscovery discovery;
  final ConnectionManager connectionManager;
  final QrScanner scanner;

  /// Called once pairing succeeds with the live connection and a tokenless
  /// `reconnect` closure (the app routes to the deck; the deck uses reconnect to
  /// recover from drops). When null, the screen just reports status.
  final void Function(
          EngineConnection conn, Future<EngineConnection> Function() reconnect)?
      onConnected;

  @override
  State<PairingScreen> createState() => _PairingScreenState();
}

class _PairingScreenState extends State<PairingScreen> {
  final List<DiscoveredEngine> _engines = [];
  String? _status;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    widget.discovery.browse().listen((engine) {
      if (!mounted) return;
      setState(() {
        if (!_engines.any((e) => e.uuid == engine.uuid)) _engines.add(engine);
      });
    }, onError: (_) {});
  }

  Future<void> _pairViaScan() async {
    final raw = await widget.scanner.scan(context);
    if (raw == null || raw.isEmpty) return;
    PairingPayload payload;
    try {
      payload = PairingPayload.parse(raw);
    } on FormatException catch (e) {
      _setStatus('Invalid pairing payload: ${e.message}');
      return;
    }
    // Reconnect reuses the payload's addresses + fingerprint but no token — the
    // engine recognises the already-paired device and lets it back in (PROJ-146).
    Future<EngineConnection> reconnect() =>
        widget.connectionManager.connectWithPayload(PairingPayload(
          addresses: payload.addresses,
          port: payload.port,
          token: '',
          fingerprint: payload.fingerprint,
        ));
    await _runPair(
        () => widget.connectionManager.connectWithPayload(payload), reconnect);
  }

  Future<void> _runPair(
    Future<EngineConnection> Function() attempt,
    Future<EngineConnection> Function() reconnect,
  ) async {
    setState(() {
      _busy = true;
      _status = 'Pairing…';
    });
    try {
      final conn = await attempt();
      _setStatus('Paired with ${conn.engineUuid} '
          '(fingerprint ${_short(conn.engineFingerprint)})');
      widget.onConnected?.call(conn, reconnect);
    } on PairingException catch (e) {
      _setStatus(switch (e.failure) {
        PairingFailure.fingerprintMismatch =>
          'Fingerprint mismatch — possible imposter engine. Pairing aborted.',
        PairingFailure.unauthorized =>
          'Pairing rejected: bad or expired token.',
        PairingFailure.badEngineSignature =>
          'Engine failed to prove its identity. Pairing aborted.',
        PairingFailure.protocol => 'Pairing failed: ${e.message}',
      });
    } catch (e) {
      _setStatus('Pairing failed: $e');
    }
  }

  void _setStatus(String s) {
    if (!mounted) return;
    setState(() {
      _busy = false;
      _status = s;
    });
  }

  static String _short(String fp) => fp.length <= 12 ? fp : fp.substring(0, 12);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pair with engine')),
      body: Column(
        children: [
          if (_status != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(_status!, key: const Key('pairing-status')),
            ),
          Expanded(
            child: _engines.isEmpty
                ? const Center(child: Text('Searching for engines…'))
                : ListView(
                    children: [
                      for (final e in _engines)
                        ListTile(
                          key: Key('engine-${e.uuid}'),
                          title: Text(e.name.isEmpty ? e.uuid : e.name),
                          subtitle: Text('${e.host}:${e.port} · '
                              'fp ${_short(e.fingerprint)}'),
                        ),
                    ],
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _busy ? null : _pairViaScan,
        icon: const Icon(Icons.qr_code_scanner),
        label: const Text('Scan QR'),
      ),
    );
  }
}
