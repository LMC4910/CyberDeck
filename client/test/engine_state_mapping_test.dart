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

    test('aggregate throughput is passthrough-only (rx/tx drive net.*)', () {
      // net.download/upload now come from system.net.rx/tx; the aggregate
      // throughput is no longer mapped to a page binding.
      final m = mapEngineStateDelta('system.net.throughput', 1000000);
      expect(m.length, 1);
      expect(m.first.id, 'system.net.throughput');
    });

    test('an unmapped engine id only passes through (no page binding)', () {
      // No engine publishes CPU temperature → sys.cpu.temp has no source → "--".
      final m = mapEngineStateDelta('system.cpu.temp', 50.0);
      expect(m.length, 1);
      expect(m.first.id, 'system.cpu.temp');
    });

    test('per-drive storage renames to the storage.<letter>.percent slots', () {
      expect(mapOf('system.disk.c.percent', 58.0)['storage.c.percent'], 58.0);
      expect(mapOf('system.disk.d.percent', 30.0)['storage.d.percent'], 30.0);
    });

    test('RAM byte breakdown formats to "X.X GB" text', () {
      const gib = 1024 * 1024 * 1024;
      expect(mapOf('system.ram.used', (10 * gib).toDouble())['sys.ram.used'],
          '10.0 GB');
      expect(mapOf('system.ram.free', (6 * gib).toDouble())['sys.ram.free'],
          '6.0 GB');
      expect(mapOf('system.ram.total', (16 * gib).toDouble())['sys.ram.total'],
          '16.0 GB');
    });

    test('network rx/tx split to download/upload Mbps', () {
      expect(mapOf('system.net.rx', 1000000)['net.download'], 8.0);
      expect(mapOf('system.net.tx', 500000)['net.upload'], 4.0);
    });

    test('system.info map renames to sys.info (passthrough)', () {
      final info = {'os': 'Windows 11', 'cpu': 'Ryzen 9', 'ram': '16 GB'};
      expect(mapOf('system.info', info)['sys.info'], info);
    });

    test('primary disk percent drives the storage donut', () {
      expect(mapOf('system.disk.percent', 58.0)['sys.storage.usedPct'], 58.0);
    });

    test('now-playing map renames to the media binding', () {
      final np = {'track': 'Starboy', 'artist': 'The Weeknd', 'playing': true};
      expect(mapOf('media.nowplaying', np)['media'], np);
    });

    test('top processes transform to list-card rows', () {
      final rows = mapOf('system.processes', [
        {'name': 'chrome.exe', 'cpu': 18.42},
        {'name': 'code.exe', 'cpu': 4.2},
      ])['sys.processes'] as List;
      expect(rows.length, 2);
      expect(rows[0]['label'], 'chrome.exe');
      expect(rows[0]['value'], '18.4%');
      expect(rows[1]['value'], '4.2%');
    });
  });

  test('formatUptimeSeconds drops leading zero units', () {
    expect(formatUptimeSeconds(45), '0m 45s');
    expect(formatUptimeSeconds(3661), '1h 1m 1s');
  });
}
