import 'dart:convert';
import 'dart:typed_data';

import 'package:cyberdeck_client/net/envelope.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('marshal matches the engine JSON byte-for-byte', () {
    // Go json.Marshal(Envelope{V:1,Ch:"state",Type:"x",Seq:5,TS:0,
    //   Payload:[]byte("hi")}) — struct field order, payload base64.
    final env = Envelope(
      ch: Channel.state,
      type: 'x',
      seq: 5,
      ts: 0,
      payload: Uint8List.fromList('hi'.codeUnits),
    );
    expect(
      utf8.decode(env.marshal()),
      '{"v":1,"ch":"state","type":"x","seq":5,"ts":0,"payload":"aGk="}',
    );
  });

  test('round-trips through JSON including the base64 payload', () {
    final env = Envelope(
      ch: Channel.layout,
      type: 'op',
      seq: 42,
      ts: 1234,
      payload: Uint8List.fromList([0, 255, 16, 7]),
    );
    final back = Envelope.unmarshal(env.marshal());
    expect(back.v, kProtocolVersion);
    expect(back.ch, Channel.layout);
    expect(back.type, 'op');
    expect(back.seq, 42);
    expect(back.ts, 1234);
    expect(back.payload, [0, 255, 16, 7]);
  });

  test('parses an engine envelope with a null payload', () {
    final env = Envelope.unmarshal(utf8.encode(
        '{"v":1,"ch":"control","type":"ping","seq":1,"ts":0,"payload":null}'));
    expect(env.ch, Channel.control);
    expect(env.payload, isEmpty);
  });

  test('SeqCounter is per-channel and monotonic from 1', () {
    final c = SeqCounter();
    expect(c.next(Channel.state), 1);
    expect(c.next(Channel.state), 2);
    expect(c.next(Channel.layout), 1);
    expect(c.next(Channel.state), 3);
  });
}
