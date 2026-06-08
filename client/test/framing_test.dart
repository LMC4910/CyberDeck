import 'dart:async';
import 'dart:typed_data';

import 'package:cyberdeck_client/net/framing.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('encodeFrame writes a uint32 big-endian length prefix', () {
    final frame = encodeFrame([0xaa, 0xbb]);
    expect(frame.sublist(0, 4), [0, 0, 0, 2]);
    expect(frame.sublist(4), [0xaa, 0xbb]);
  });

  test('readFrames reassembles frames split across chunks', () async {
    final f1 = encodeFrame([1, 2, 3]);
    final f2 = encodeFrame([4, 5]);
    final combined = Uint8List.fromList([...f1, ...f2]);

    // Feed one byte at a time to stress the buffering.
    final source = Stream<List<int>>.fromIterable(
        [for (final b in combined) [b]]);
    final frames = await readFrames(source).toList();
    expect(frames, [
      [1, 2, 3],
      [4, 5],
    ]);
  });

  test('readFrames coalesces multiple frames in one chunk', () async {
    final combined = Uint8List.fromList(
        [...encodeFrame([1]), ...encodeFrame([2]), ...encodeFrame([3])]);
    final frames = await readFrames(Stream.value(combined)).toList();
    expect(frames.map((f) => f.toList()), [
      [1],
      [2],
      [3],
    ]);
  });

  test('encodeFrame rejects oversize payloads', () {
    expect(() => encodeFrame(Uint8List(10), maxFrameSize: 4),
        throwsA(isA<FrameTooLargeException>()));
  });

  test('readFrames rejects an oversize declared length', () async {
    final hdr = Uint8List(4);
    ByteData.sublistView(hdr).setUint32(0, 1000, Endian.big);
    expect(
      () => readFrames(Stream.value(hdr), maxFrameSize: 8).toList(),
      throwsA(isA<FrameTooLargeException>()),
    );
  });
}
