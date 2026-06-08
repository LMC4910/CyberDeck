import 'dart:convert';
import 'dart:typed_data';

import 'package:cyberdeck_client/crypto/crypto.dart';
import 'package:cyberdeck_client/net/conn.dart';
import 'package:cyberdeck_client/net/encrypted_session.dart';
import 'package:cyberdeck_client/net/envelope.dart';
import 'package:cyberdeck_client/net/framing.dart';
import 'package:flutter_test/flutter_test.dart';

/// Records outbound bytes while delegating to an inner connection.
class _RecordingConn implements DuplexConn {
  _RecordingConn(this._inner);
  final DuplexConn _inner;
  final BytesBuilder sent = BytesBuilder();
  @override
  Stream<Uint8List> get incoming => _inner.incoming;
  @override
  void add(List<int> bytes) {
    sent.add(bytes);
    _inner.add(bytes);
  }

  @override
  Future<void> close() => _inner.close();
}

bool _contains(List<int> haystack, List<int> needle) {
  for (var i = 0; i + needle.length <= haystack.length; i++) {
    var ok = true;
    for (var j = 0; j < needle.length; j++) {
      if (haystack[i + j] != needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

void main() {
  final keys = SessionKeys(
    initiatorToResponder: List<int>.filled(32, 7),
    responderToInitiator: List<int>.filled(32, 9),
  );

  test('encrypted round-trip; the plaintext never appears on the wire', () async {
    final (rawA, rawB) = duplexPipe();
    final recA = _RecordingConn(rawA);
    final init = EncryptedSession.create(
        frames: FrameChannel(recA), keys: keys, isInitiator: true);
    final resp = EncryptedSession.create(
        frames: FrameChannel(rawB), keys: keys, isInitiator: false);

    const secret = 'SUPERSECRET-do-not-leak';
    await init.send(Envelope(
      ch: Channel.state,
      type: 'secret',
      payload: Uint8List.fromList(utf8.encode(secret)),
    ));

    final got = await resp.received.first;
    expect(utf8.decode(got.payload), secret); // decrypts correctly

    // Nothing the initiator wrote contains the plaintext bytes (P1-AC-03).
    expect(_contains(recA.sent.toBytes(), utf8.encode(secret)), isFalse);

    await init.close();
    await resp.close();
  });

  test('a tampered record tears the session down with an error', () async {
    final (a, b) = duplexPipe();
    final resp = EncryptedSession.create(
        frames: FrameChannel(b), keys: keys, isInitiator: false);
    final sender = RecordCipher(keys.send(isInitiator: true));

    final env = Envelope(
        ch: Channel.state, type: 'x', payload: Uint8List.fromList([1, 2]));

    // A valid record opens fine.
    a.add(encodeFrame(await sender.seal(env.marshal())));
    final got = await resp.received.first;
    expect(got.payload, [1, 2]);

    // A tampered record fails AEAD auth → teardown.
    final bad = await sender.seal(env.marshal());
    bad[bad.length - 1] ^= 0xff;
    a.add(encodeFrame(bad));

    await resp.done;
    expect(resp.error, isNotNull);
  });
}
