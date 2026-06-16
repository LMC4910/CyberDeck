// Verifies the live-engine telemetry mapping: engine `system.*` deltas are
// translated to the page binding ids the authored pages use, so the client's
// own 7 pages light up with real data (and unmapped ids stay "--").
import 'package:cyberdeck_client/data/deck_source.dart';
import 'package:cyberdeck_client/data/engine_deck_source.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Map<String, Object?> mapOf(String id, Object? v) =>
      {for (final StateUpdate u in mapEngineStateDelta(id, v)) u.id: u.value};

  group('mapEngineStateDelta', () {
    test('telemetry renames to the page binding ids (with passthrough)', () {
      final m = mapOf('system.ram.percent', 62.0);
      expect(m['system.ram.percent'], 62.0); // passthrough preserved
      expect(m['sys.ram'], 62.0); // page binding driven
      expect(mapOf('system.cpu.percent', 28.0)['sys.cpu.load'], 28.0);
      expect(mapOf('system.gpu.load', 67.0)['sys.gpu.load'], 67.0);
      expect(mapOf('system.gpu.temp', 61.0)['sys.gpu.temp'], 61.0);
    });

    test('volume fans out to both bindings; muted maps', () {
      final v = mapOf('system.volume', 70.0);
      expect(v['media.volume'], 70.0);
      expect(v['media.volume.system'], 70.0);
      expect(mapOf('system.muted', true)['media.muted'], true);
    });

    test('uptime seconds format to text', () {
      expect(mapOf('system.uptime', 220952)['sys.uptime'], '2d 13h 22m 32s');
    });

    test('network throughput converts bytes/s → Mbps', () {
      expect(mapOf('system.net.throughput', 1000000)['net.download'], 8.0);
    });

    test('an unmapped engine id only passes through (no page binding)', () {
      // No engine publishes CPU temperature → sys.cpu.temp has no source → "--".
      final m = mapEngineStateDelta('system.cpu.temp', 50.0);
      expect(m.length, 1);
      expect(m.first.id, 'system.cpu.temp');
    });
  });

  test('formatUptimeSeconds drops leading zero units', () {
    expect(formatUptimeSeconds(45), '0m 45s');
    expect(formatUptimeSeconds(3661), '1h 1m 1s');
  });
}
