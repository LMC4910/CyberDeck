// Deck screen tests: the assembled client renders the engine-authored layout,
// applies live state, and sends interactions back over the control channel — driven
// by an in-memory encrypted session pair standing in for a paired engine.

import 'dart:convert';
import 'dart:typed_data';

import 'package:cyberdeck_client/app/deck.dart';
import 'package:cyberdeck_client/crypto/crypto.dart';
import 'package:cyberdeck_client/net/channels.dart';
import 'package:cyberdeck_client/net/conn.dart';
import 'package:cyberdeck_client/net/connection_manager.dart';
import 'package:cyberdeck_client/net/encrypted_session.dart';
import 'package:cyberdeck_client/net/envelope.dart';
import 'package:cyberdeck_client/net/framing.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> _push(
    EncryptedSession engine, Channel ch, String type, Map<String, dynamic> m) {
  return engine.send(Envelope(
    ch: ch,
    type: type,
    payload: Uint8List.fromList(utf8.encode(jsonEncode(m))),
  ));
}

final _snapshot = <String, dynamic>{
  'id': 'home',
  'grid': {'columns': 4, 'rows': 4},
  'version': 1,
  'widgets': [
    {
      'id': 'b1',
      'type': 'button',
      'placement': {'col': 0, 'row': 0, 'colSpan': 2, 'rowSpan': 1},
      'appearance': {
        'style': {'label': 'LOCK'}
      },
      'interaction': {
        'tap': {'target': 'action', 'ref': 'system.lock'}
      },
      'config': {'confirm': false},
    },
    {
      'id': 'g1',
      'type': 'gauge.circular',
      'placement': {'col': 0, 'row': 2, 'colSpan': 2, 'rowSpan': 2},
      'appearance': {
        'stateBinding': 'system.cpu.percent',
        'style': {'label': 'CPU'}
      },
      'config': {'min': 0, 'max': 100, 'unit': '%'},
    },
  ],
};

void main() {
  testWidgets('deck shows a waiting state before any layout arrives',
      (tester) async {
    late EngineConnection conn;
    late EncryptedSession engine;
    await tester.runAsync(() async {
      (conn, engine) = await _pairedConnection();
    });
    await tester.pumpWidget(MaterialApp(home: DeckScreen(connection: conn)));
    expect(find.text('Waiting for layout…'), findsOneWidget);
    await tester.runAsync(() async {
      await conn.close();
      await engine.close();
    });
  });

  testWidgets('deck renders the snapshot, applies state, and sends interactions',
      (tester) async {
    late EngineConnection conn;
    late EncryptedSession engine;
    await tester.runAsync(() async {
      (conn, engine) = await _pairedConnection();
    });
    await tester.pumpWidget(MaterialApp(home: DeckScreen(connection: conn)));

    // Engine pushes the layout → the button renders.
    await tester.runAsync(() async {
      await _push(engine, Channel.layout, 'layout.snapshot', _snapshot);
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pump();
    await tester.pump();
    expect(find.text('LOCK'), findsOneWidget);
    expect(find.byKey(const Key('gauge-value-g1')), findsOneWidget);

    // A state delta repaints the gauge (value flows in, no crash).
    await tester.runAsync(() async {
      await _push(engine, Channel.state, 'state.delta',
          {'id': 'system.cpu.percent', 'value': 42.0});
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pump();
    expect(find.byKey(const Key('gauge-value-g1')), findsOneWidget);

    await tester.runAsync(() async {
      await conn.close();
      await engine.close();
    });
  });

  // The deck → engine interaction roundtrip (tap → control-channel "interaction")
  // is driven entirely on the real event loop so the encrypted pipe flushes.
  testWidgets('a button tap sends an interaction to the engine', (tester) async {
    late EngineConnection conn;
    late EncryptedSession engine;
    await tester.runAsync(() async {
      (conn, engine) = await _pairedConnection();
    });
    await tester.pumpWidget(MaterialApp(home: DeckScreen(connection: conn)));
    await tester.runAsync(() async {
      await _push(engine, Channel.layout, 'layout.snapshot', _snapshot);
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pump();
    await tester.pump();

    Map<String, dynamic>? got;
    await tester.runAsync(() async {
      final waitControl = engine.received
          .firstWhere((e) => e.ch == Channel.control)
          .timeout(const Duration(seconds: 3));
      await tester.tap(find.text('LOCK'));
      final env = await waitControl;
      got = jsonDecode(utf8.decode(env.payload)) as Map<String, dynamic>;
    });
    expect(got?['actionId'], 'system.lock');

    await tester.runAsync(() async {
      await conn.close();
      await engine.close();
    });
  });
}

// _pairedConnection builds a client EngineConnection and the matching engine-side
// session over an in-memory pipe with shared keys (skips the handshake — the
// handshake itself is covered by pairing_test).
Future<(EngineConnection, EncryptedSession)> _pairedConnection() async {
  final keys = SessionKeys(
    initiatorToResponder: List<int>.filled(32, 7),
    responderToInitiator: List<int>.filled(32, 9),
  );
  final (a, b) = duplexPipe();
  final client = EncryptedSession.create(
      frames: FrameChannel(a), keys: keys, isInitiator: true, deviceUuid: 'dev');
  final engine = EncryptedSession.create(
      frames: FrameChannel(b), keys: keys, isInitiator: false, deviceUuid: 'dev');
  final conn = EngineConnection(
    session: client,
    router: ChannelRouter(client),
    engineUuid: 'engine-1',
    engineFingerprint: 'fp',
    defaultPermsJson: '{}',
  );
  return (conn, engine);
}
