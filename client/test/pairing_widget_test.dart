import 'dart:async';

import 'package:cyberdeck_client/app/pairing.dart';
import 'package:cyberdeck_client/net/conn.dart';
import 'package:cyberdeck_client/net/connection_manager.dart';
import 'package:cyberdeck_client/net/discovery.dart';
import 'package:cyberdeck_client/net/framing.dart';
import 'package:cyberdeck_client/net/pairing.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/mock_engine.dart';

class _FakeDiscovery implements EngineDiscovery {
  _FakeDiscovery(this.engines);
  final List<DiscoveredEngine> engines;
  @override
  Stream<DiscoveredEngine> browse({Duration timeout = const Duration(seconds: 4)}) =>
      Stream<DiscoveredEngine>.fromIterable(engines);
}

class _FakeScanner implements QrScanner {
  _FakeScanner(this.payload);
  final String payload;
  @override
  Future<String?> scan(BuildContext context) async => payload;
}

Future<ConnectionManager> _cmFor(MockEngine mock, {required String token}) async {
  return ConnectionManager(
    identity: await DeviceIdentity.generate(),
    sleep: (_) async {},
    dialer: (host, port) async {
      final (a, b) = duplexPipe();
      unawaited(mock
          .serve(FrameChannel(b), expectedToken: token)
          .catchError((_) => null));
      return FrameChannel(a);
    },
  );
}

void main() {
  testWidgets('lists discovered engines', (tester) async {
    final mock = await MockEngine.create();
    final cm = await _cmFor(mock, token: 'tok');
    final discovery = _FakeDiscovery([
      DiscoveredEngine(
        name: 'Living Room',
        uuid: 'u-1',
        version: '1.0',
        fingerprint: 'abcdef0123',
        host: '192.168.1.5',
        port: 47600,
      ),
    ]);

    await tester.pumpWidget(MaterialApp(
      home: PairingScreen(
        discovery: discovery,
        connectionManager: cm,
        scanner: _FakeScanner(''),
      ),
    ));
    await tester.pump(); // let the discovery stream emit

    expect(find.text('Living Room'), findsOneWidget);
  });

  testWidgets('successful pair shows a paired status', (tester) async {
    final mock = await MockEngine.create();
    final cm = await _cmFor(mock, token: 'tok');
    final payload = PairingPayload(
      addresses: ['192.168.1.5'],
      port: 47600,
      token: 'tok',
      fingerprint: await mock.fingerprint(),
    );

    await tester.pumpWidget(MaterialApp(
      home: PairingScreen(
        discovery: _FakeDiscovery(const []),
        connectionManager: cm,
        scanner: _FakeScanner(payload.encode()),
      ),
    ));
    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();

    final status = tester.widget<Text>(find.byKey(const Key('pairing-status')));
    expect(status.data, contains('Paired with ${mock.uuid}'));
  });

  testWidgets('fingerprint mismatch shows a clear error', (tester) async {
    final mock = await MockEngine.create();
    final cm = await _cmFor(mock, token: 'tok');
    final payload = PairingPayload(
      addresses: ['192.168.1.5'],
      port: 47600,
      token: 'tok',
      fingerprint: 'deadbeef' * 8, // wrong
    );

    await tester.pumpWidget(MaterialApp(
      home: PairingScreen(
        discovery: _FakeDiscovery(const []),
        connectionManager: cm,
        scanner: _FakeScanner(payload.encode()),
      ),
    ));
    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();

    final status = tester.widget<Text>(find.byKey(const Key('pairing-status')));
    expect(status.data, contains('mismatch'));
  });
}
