/// Wire envelope (PROJ-180), mirroring the engine's `transport.Envelope`
/// (Master §6.3): `{v, ch, type, seq, ts, payload}` serialized as JSON with the
/// `payload` bytes base64-encoded (Go marshals `[]byte` as base64), so client and
/// engine envelopes are byte-identical on the wire.
library;

import 'dart:convert';
import 'dart:typed_data';

/// Wire envelope version (matches `transport.ProtocolVersion`).
const int kProtocolVersion = 1;

/// Logical channel an envelope rides (2A §6 / ADR-0011).
enum Channel {
  state('state'),
  layout('layout'),
  preview('preview'),
  control('control');

  const Channel(this.wire);

  /// The on-wire channel string.
  final String wire;

  /// Parses a channel from its wire string.
  static Channel fromWire(String s) =>
      Channel.values.firstWhere((c) => c.wire == s,
          orElse: () => throw FormatException('unknown channel: $s'));
}

/// The shared wire envelope. [payload] carries already-encoded inner bytes.
class Envelope {
  Envelope({
    this.v = kProtocolVersion,
    required this.ch,
    required this.type,
    this.seq = 0,
    this.ts = 0,
    Uint8List? payload,
  }) : payload = payload ?? Uint8List(0);

  final int v;
  final Channel ch;
  final String type;
  final int seq;
  final int ts;
  final Uint8List payload;

  Map<String, dynamic> toJson() => {
        'v': v,
        'ch': ch.wire,
        'type': type,
        'seq': seq,
        'ts': ts,
        // Go: nil []byte → null; non-empty → base64. The engine always sends a
        // payload, so emit base64 when present and null when empty.
        'payload': payload.isEmpty ? null : base64.encode(payload),
      };

  factory Envelope.fromJson(Map<String, dynamic> m) => Envelope(
        v: (m['v'] as num?)?.toInt() ?? 0,
        ch: Channel.fromWire(m['ch'] as String? ?? ''),
        type: m['type'] as String? ?? '',
        seq: (m['seq'] as num?)?.toInt() ?? 0,
        ts: (m['ts'] as num?)?.toInt() ?? 0,
        payload: m['payload'] == null
            ? Uint8List(0)
            : Uint8List.fromList(base64.decode(m['payload'] as String)),
      );

  /// Encodes the envelope to its JSON wire bytes.
  Uint8List marshal() => Uint8List.fromList(utf8.encode(jsonEncode(toJson())));

  /// Decodes an envelope from JSON wire bytes.
  static Envelope unmarshal(List<int> data) =>
      Envelope.fromJson(jsonDecode(utf8.decode(data)) as Map<String, dynamic>);
}

/// Issues per-channel monotonic sequence numbers (from 1), matching
/// `transport.SeqCounter`.
class SeqCounter {
  final Map<Channel, int> _seqs = {};

  int next(Channel ch) {
    final v = (_seqs[ch] ?? 0) + 1;
    _seqs[ch] = v;
    return v;
  }
}
