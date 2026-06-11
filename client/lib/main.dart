/// CyberDeck client app entrypoint: load the device identity, pair with an engine
/// (QR scan on Android, paste on desktop), then render its live deck.
library;

import 'package:flutter/material.dart';

import 'app/deck.dart';
import 'app/pairing.dart';
import 'net/connection_manager.dart';
import 'net/discovery.dart';
import 'net/pairing.dart';

void main() => runApp(const CyberDeckApp());

class CyberDeckApp extends StatefulWidget {
  const CyberDeckApp({super.key});

  @override
  State<CyberDeckApp> createState() => _CyberDeckAppState();
}

class _CyberDeckAppState extends State<CyberDeckApp> {
  DeviceIdentity? _identity;
  EngineConnection? _conn;

  @override
  void initState() {
    super.initState();
    // In-memory identity for this slice (re-pair each launch); a secure persistent
    // KeyStore (Android Keystore / Windows DPAPI) is a strengthening follow-up.
    DeviceIdentity.loadOrCreate(InMemoryKeyStore()).then((id) {
      if (mounted) setState(() => _identity = id);
    });
  }

  void _onConnected(EngineConnection c) => setState(() => _conn = c);

  Future<void> _disconnect() async {
    final c = _conn;
    setState(() => _conn = null);
    if (c != null) await c.close();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CyberDeck',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        scaffoldBackgroundColor: const Color(0xFF0A0E14),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF00E5FF),
          brightness: Brightness.dark,
        ),
      ),
      home: _home(),
    );
  }

  Widget _home() {
    final id = _identity;
    if (id == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final conn = _conn;
    if (conn != null) {
      return DeckScreen(connection: conn, onDisconnect: _disconnect);
    }
    return PairingScreen(
      discovery: MdnsEngineDiscovery(),
      connectionManager: ConnectionManager(identity: id),
      scanner: defaultQrScanner(),
      onConnected: _onConnected,
    );
  }
}
