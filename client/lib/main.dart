/// CyberDeck client app entrypoint. Routes: Landing → (Demo Mode | Connect →
/// Pairing) → the app Shell (nav rail + top bar + hosted deck). Demo Mode is the
/// offline, zero-setup path used to exercise the full experience on desktop and
/// mobile.
library;

import 'package:flutter/material.dart';

import 'app/landing.dart';
import 'app/pairing.dart';
import 'app/shell.dart';
import 'data/deck_source.dart';
import 'data/engine_deck_source.dart';
import 'data/mock_deck_source.dart';
import 'net/connection_manager.dart';
import 'net/discovery.dart';
import 'net/pairing.dart';
import 'theme/app_theme.dart';

void main() => runApp(const CyberDeckApp());

class CyberDeckApp extends StatelessWidget {
  const CyberDeckApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CyberDeck',
      debugShowCheckedModeBanner: false,
      theme: buildDeckTheme(),
      home: const RootScreen(),
    );
  }
}

class RootScreen extends StatefulWidget {
  const RootScreen({super.key});

  @override
  State<RootScreen> createState() => _RootScreenState();
}

class _RootScreenState extends State<RootScreen> {
  DeviceIdentity? _identity;
  DeckSource? _source;
  bool _pairing = false;
  bool _connecting = false;

  @override
  void initState() {
    super.initState();
    DeviceIdentity.loadOrCreate(InMemoryKeyStore())
        .then((id) => mounted ? setState(() => _identity = id) : null);
  }

  void _enterDemo() => setState(() => _source = MockDeckSource());

  void _connect() => setState(() => _pairing = true);

  Future<void> _onConnected(
      EngineConnection conn, Future<EngineConnection> Function() reconnect) async {
    setState(() {
      _pairing = false;
      _connecting = true;
    });
    final src = EngineDeckSource(conn, reconnect: reconnect);
    try {
      await src.ready.timeout(const Duration(seconds: 8));
      if (!mounted) return;
      setState(() {
        _source = src;
        _connecting = false;
      });
    } catch (e) {
      await src.dispose();
      if (!mounted) return;
      setState(() => _connecting = false);
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Engine sent no deck: $e')));
    }
  }

  Future<void> _leaveSource() async {
    final s = _source;
    setState(() => _source = null);
    await s?.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_connecting) {
      return const Scaffold(
        body: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Connecting…'),
          ]),
        ),
      );
    }
    if (_pairing) {
      final id = _identity;
      if (id == null) {
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      }
      return PairingScreen(
        discovery: MdnsEngineDiscovery(),
        connectionManager: ConnectionManager(identity: id),
        scanner: defaultQrScanner(),
        onConnected: _onConnected,
      );
    }
    final source = _source;
    if (source == null) {
      return LandingScreen(onDemo: _enterDemo, onConnect: _connect);
    }
    return AppShell(source: source, onExit: _leaveSource);
  }
}
