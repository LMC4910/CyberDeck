/// Landing screen: choose Demo Mode (offline, seed decks) or Connect to a live
/// engine. Demo Mode is the zero-setup path used for cross-platform testing.
library;

import 'package:flutter/material.dart';

class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key, required this.onDemo, required this.onConnect});

  final VoidCallback onDemo;
  final VoidCallback onConnect;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E14),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.dashboard_customize,
                    size: 72, color: Color(0xFF00E5FF)),
                const SizedBox(height: 16),
                Text('CyberDeck',
                    textAlign: TextAlign.center,
                    style: Theme.of(context)
                        .textTheme
                        .headlineMedium
                        ?.copyWith(letterSpacing: 2)),
                const SizedBox(height: 4),
                const Text('Your command center',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white54)),
                const SizedBox(height: 40),
                FilledButton.icon(
                  key: const Key('landing-demo'),
                  onPressed: onDemo,
                  icon: const Icon(Icons.play_circle_outline),
                  label: const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Text('Enter Demo Mode'),
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  key: const Key('landing-connect'),
                  onPressed: onConnect,
                  icon: const Icon(Icons.cast_connected),
                  label: const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Text('Connect to Engine'),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Demo Mode runs offline with sample decks and live mock telemetry — '
                  'no engine required.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white38, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
