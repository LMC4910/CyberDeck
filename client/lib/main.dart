/// CyberDeck client app entrypoint. Routes: Landing → (Demo Mode | Connect →
/// Pairing) → Deck list → Deck. Demo Mode is the offline, zero-setup path used to
/// exercise the full experience on desktop and mobile.
library;

import 'package:flutter/material.dart';

import 'app/deck.dart';
import 'app/deck_list.dart';
import 'app/landing.dart';
import 'app/pairing.dart';
import 'data/deck_source.dart';
import 'data/engine_deck_source.dart';
import 'data/mock_deck_source.dart';
import 'net/connection_manager.dart';
import 'net/discovery.dart';
import 'net/pairing.dart';

void main() => runApp(const CyberDeckApp());

class CyberDeckApp extends StatelessWidget {
  const CyberDeckApp({super.key});

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
  String? _deckId;
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

  Future<void> _onConnected(EngineConnection conn) async {
    setState(() {
      _pairing = false;
      _connecting = true;
    });
    final src = EngineDeckSource(conn);
    try {
      await src.ready.timeout(const Duration(seconds: 8));
      if (!mounted) return;
      setState(() {
        _source = src;
        _deckId = 'live';
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
    setState(() {
      _source = null;
      _deckId = null;
    });
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
    if (_deckId == null) {
      return DeckListScreen(
        source: source,
        onOpen: (id) => setState(() => _deckId = id),
        onBack: _leaveSource,
      );
    }
    return DeckScreen(
      source: source,
      deckId: _deckId!,
      onBack: () => setState(() => _deckId = null),
    );
  }
}
