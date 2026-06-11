// EngineDeckSource robustness: it auto-reconnects (tokenless) when the link drops,
// driven by an in-memory encrypted session pair standing in for the engine.

import 'package:cyberdeck_client/crypto/crypto.dart';
import 'package:cyberdeck_client/data/deck_source.dart';
import 'package:cyberdeck_client/data/engine_deck_source.dart';
import 'package:cyberdeck_client/net/channels.dart';
import 'package:cyberdeck_client/net/conn.dart';
import 'package:cyberdeck_client/net/connection_manager.dart';
import 'package:cyberdeck_client/net/encrypted_session.dart';
import 'package:cyberdeck_client/net/framing.dart';
import 'package:flutter_test/flutter_test.dart';

Future<(EngineConnection, EncryptedSession)> _makePair() async {
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

Future<void> _waitUntil(bool Function() cond, {Duration timeout = const Duration(seconds: 5)}) async {
  final end = DateTime.now().add(timeout);
  while (!cond()) {
    if (DateTime.now().isAfter(end)) fail('condition not met within $timeout');
    await Future<void>.delayed(const Duration(milliseconds: 20));
  }
}

void main() {
  test('auto-reconnects via the tokenless reconnect closure on drop', () async {
    final (conn1, eng1) = await _makePair();
    var calls = 0;
    EncryptedSession? eng2;
    final src = EngineDeckSource(conn1, reconnect: () async {
      calls++;
      final (c2, e2) = await _makePair();
      eng2 = e2;
      return c2;
    });

    expect(src.status.value, ConnStatus.connected);

    await eng1.close(); // simulate the engine dropping the link

    await _waitUntil(
        () => calls == 1 && src.status.value == ConnStatus.connected);

    await src.dispose();
    await eng2?.close();
  });

  test('a drop with no reconnect callback goes to disconnected', () async {
    final (conn, eng) = await _makePair();
    final src = EngineDeckSource(conn); // no reconnect

    await eng.close();
    await _waitUntil(() => src.status.value == ConnStatus.disconnected,
        timeout: const Duration(seconds: 3));

    await src.dispose();
  });
}
