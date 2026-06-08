import 'package:cyberdeck_client/net/discovery.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('parseTxtEntries', () {
    test('parses key=value, keeps unknown keys, skips malformed', () {
      final map = parseTxtEntries([
        'name=Engine',
        'uuid=u-1',
        'future=whatever',
        'noequals',
        'fp=abc',
      ]);
      expect(map['name'], 'Engine');
      expect(map['uuid'], 'u-1');
      expect(map['future'], 'whatever');
      expect(map['fp'], 'abc');
      expect(map.containsKey('noequals'), isFalse);
    });

    test('value may contain = signs', () {
      final map = parseTxtEntries(['k=a=b=c']);
      expect(map['k'], 'a=b=c');
    });
  });

  group('DiscoveredEngine.fromTxt', () {
    test('builds a full record', () {
      final engine = DiscoveredEngine.fromTxt(
        {'name': 'Engine', 'uuid': 'u-1', 'ver': '1.0.0', 'fp': 'abc123'},
        host: '192.168.1.5',
        port: 47600,
      );
      expect(engine, isNotNull);
      expect(engine!.name, 'Engine');
      expect(engine.uuid, 'u-1');
      expect(engine.version, '1.0.0');
      expect(engine.fingerprint, 'abc123');
      expect(engine.host, '192.168.1.5');
      expect(engine.port, 47600);
    });

    test('returns null without a uuid', () {
      final engine = DiscoveredEngine.fromTxt(
        {'fp': 'abc'},
        host: 'h',
        port: 1,
      );
      expect(engine, isNull);
    });

    test('returns null without a fingerprint', () {
      final engine = DiscoveredEngine.fromTxt(
        {'uuid': 'u'},
        host: 'h',
        port: 1,
      );
      expect(engine, isNull);
    });

    test('tolerates missing optional name/version', () {
      final engine = DiscoveredEngine.fromTxt(
        {'uuid': 'u', 'fp': 'f'},
        host: 'h',
        port: 2,
      );
      expect(engine, isNotNull);
      expect(engine!.name, '');
      expect(engine.version, '');
    });
  });

  group('DiscoveredEngine equality', () {
    DiscoveredEngine make({String uuid = 'u'}) => DiscoveredEngine(
          name: 'n',
          uuid: uuid,
          version: '1',
          fingerprint: 'f',
          host: 'h',
          port: 1,
        );

    test('equal when all fields match', () {
      expect(make(), equals(make()));
      expect(make().hashCode, make().hashCode);
    });

    test('not equal when a field differs', () {
      expect(make(uuid: 'a'), isNot(equals(make(uuid: 'b'))));
    });
  });
}
