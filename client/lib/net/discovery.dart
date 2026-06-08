/// Engine discovery over mDNS / DNS-SD (PROJ-147, TRD 2A §3 / FR-2.2).
///
/// The engine advertises `_cyberdeck._tcp.local` with TXT records
/// `{name, uuid, ver, fp}` (fp = engine public-key fingerprint, the anti-MITM
/// check at pairing). This module browses the LAN and lists discovered engines.
/// Discovery is the primary happy path but not the only one — manual entry is the
/// fallback for multicast-blocked networks — so callers must not treat it as
/// required.
library;

import 'package:multicast_dns/multicast_dns.dart';

/// DNS-SD service type the engine advertises under.
const String kCyberdeckServiceType = '_cyberdeck._tcp.local';

const String _txtName = 'name';
const String _txtUuid = 'uuid';
const String _txtVer = 'ver';
const String _txtFp = 'fp';

/// An engine discovered on the LAN.
class DiscoveredEngine {
  const DiscoveredEngine({
    required this.name,
    required this.uuid,
    required this.version,
    required this.fingerprint,
    required this.host,
    required this.port,
  });

  /// Human-readable instance name.
  final String name;

  /// Engine UUID (stable identity).
  final String uuid;

  /// Engine version string.
  final String version;

  /// Engine public-key fingerprint (verified against QR/visual at pairing).
  final String fingerprint;

  /// Resolved host (IP or hostname).
  final String host;

  /// SRV port.
  final int port;

  /// Builds an engine from parsed TXT key/values plus the resolved host/port.
  ///
  /// Returns `null` when the record lacks a uuid or fingerprint — without an
  /// identity and an anti-MITM fingerprint it is not a usable, verifiable engine.
  static DiscoveredEngine? fromTxt(
    Map<String, String> txt, {
    required String host,
    required int port,
  }) {
    final uuid = txt[_txtUuid] ?? '';
    final fingerprint = txt[_txtFp] ?? '';
    if (uuid.isEmpty || fingerprint.isEmpty) {
      return null;
    }
    return DiscoveredEngine(
      name: txt[_txtName] ?? '',
      uuid: uuid,
      version: txt[_txtVer] ?? '',
      fingerprint: fingerprint,
      host: host,
      port: port,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is DiscoveredEngine &&
      other.name == name &&
      other.uuid == uuid &&
      other.version == version &&
      other.fingerprint == fingerprint &&
      other.host == host &&
      other.port == port;

  @override
  int get hashCode => Object.hash(name, uuid, version, fingerprint, host, port);

  @override
  String toString() =>
      'DiscoveredEngine($name $uuid @ $host:$port fp=$fingerprint)';
}

/// Parses DNS-SD TXT entries of the form `key=value` into a map. Unknown keys are
/// kept; entries without `=` are skipped (mirrors the engine's parseTXT).
Map<String, String> parseTxtEntries(Iterable<String> entries) {
  final map = <String, String>{};
  for (final entry in entries) {
    final i = entry.indexOf('=');
    if (i < 0) {
      continue;
    }
    map[entry.substring(0, i)] = entry.substring(i + 1);
  }
  return map;
}

/// Browses the LAN for CyberDeck engines.
abstract class EngineDiscovery {
  /// Emits engines as they are discovered, completing after [timeout].
  Stream<DiscoveredEngine> browse({Duration timeout});
}

/// mDNS-backed discovery using `package:multicast_dns`.
class MdnsEngineDiscovery implements EngineDiscovery {
  MdnsEngineDiscovery({MDnsClient Function()? clientFactory})
      : _clientFactory = clientFactory ?? MDnsClient.new;

  final MDnsClient Function() _clientFactory;

  @override
  Stream<DiscoveredEngine> browse({
    Duration timeout = const Duration(seconds: 4),
  }) async* {
    final client = _clientFactory();
    await client.start();
    try {
      await for (final ptr in client
          .lookup<PtrResourceRecord>(
            ResourceRecordQuery.serverPointer(kCyberdeckServiceType),
          )
          .timeout(timeout, onTimeout: (sink) => sink.close())) {
        yield* _resolve(client, ptr.domainName);
      }
    } finally {
      client.stop();
    }
  }

  /// Resolves a service instance (SRV → host/port, TXT → records, A → IP) into a
  /// discovered engine.
  Stream<DiscoveredEngine> _resolve(MDnsClient client, String instance) async* {
    await for (final srv in client.lookup<SrvResourceRecord>(
      ResourceRecordQuery.service(instance),
    )) {
      final txt = <String, String>{};
      await for (final rec in client.lookup<TxtResourceRecord>(
        ResourceRecordQuery.text(instance),
      )) {
        txt.addAll(parseTxtEntries(rec.text.split('\n')));
      }

      var host = srv.target;
      await for (final ip in client.lookup<IPAddressResourceRecord>(
        ResourceRecordQuery.addressIPv4(srv.target),
      )) {
        host = ip.address.address;
        break;
      }

      final engine = DiscoveredEngine.fromTxt(txt, host: host, port: srv.port);
      if (engine != null) {
        yield engine;
      }
    }
  }
}
