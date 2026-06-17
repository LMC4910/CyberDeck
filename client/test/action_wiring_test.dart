// Guards the launch/volume wiring (PROJ — real plugin functions): the authored
// pages must address the engine's REAL generic action ids — `launch.url`/`launch.app`
// (+ a target param) and `volume.set`/`volume.mute` — not the old app-specific ids
// the registry never knew (which silently audited `interaction.rejected`). A walk
// over all 7 seed pages asserts every action in the backed namespaces resolves, so
// a future typo or a half-wired tile fails the build instead of failing silently.
import 'package:cyberdeck_client/data/pages/builders.dart';
import 'package:cyberdeck_client/data/seed_decks.dart';
import 'package:cyberdeck_client/gestures/slots.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  // The action ids the engine registry actually routes to a real plugin
  // (engine/cmd/cyberdeck/main.go builtinLookup).
  const liveLaunch = {'launch.url', 'launch.app'};
  const liveVolume = {'volume.set', 'volume.mute'};
  const livePower = {
    'system.shutdown',
    'system.restart',
    'system.sleep',
    'system.hibernate',
    'system.lock',
    'system.logoff',
  };

  group('builders carry an action param', () {
    test('launcher emits {action, param} and interactionFor surfaces it', () {
      final n = launcher('x',
          label: 'L',
          action: 'launch.url',
          param: 'https://example.com',
          placement: at(0, 0));
      final t = interactionFor(n, Slots.tap)!;
      expect(t.kind, 'action');
      expect(t.ref, 'launch.url');
      expect(t.param, 'https://example.com');
    });

    test('no param → no param key (null)', () {
      final n =
          iconButton('y', icon: 'mute', action: 'volume.mute', placement: at(0, 0));
      expect(interactionFor(n, Slots.tap)!.param, isNull);
    });

    test('slider param rides the dragValue slot', () {
      final s = slider('s',
          action: 'launch.url', param: 'steam://run/1', placement: at(0, 0));
      final t = interactionFor(s, Slots.dragValue)!;
      expect(t.ref, 'launch.url');
      expect(t.param, 'steam://run/1');
    });
  });

  test('every backed-namespace action on the 7 pages resolves to a real id', () {
    final seen = <String>{};
    for (final deck in seedDecks()) {
      for (final node in deck.page.widgets) {
        for (final slot in Slots.all) {
          final t = interactionFor(node, slot);
          if (t == null || t.isNone || t.kind != 'action') continue;
          seen.add(t.ref);

          if (t.ref.startsWith('launch.')) {
            expect(liveLaunch.contains(t.ref), isTrue,
                reason: '${node.id} uses unknown launch id "${t.ref}"');
            expect(t.param != null && t.param!.isNotEmpty, isTrue,
                reason: '${node.id} ("${t.ref}") is missing its target param');
          }
          if (t.ref.startsWith('volume.')) {
            expect(liveVolume.contains(t.ref), isTrue,
                reason: '${node.id} uses unknown volume id "${t.ref}"');
          }
        }
      }
    }

    // Sanity: the wiring actually happened — both launch forms, both volume
    // actions, and all six power actions are present across the deck.
    expect(seen.containsAll(liveLaunch), isTrue,
        reason: 'expected both launch.url and launch.app to be wired');
    expect(seen.containsAll(liveVolume), isTrue,
        reason: 'expected both volume.set and volume.mute to be wired');
    expect(seen.containsAll(livePower), isTrue,
        reason: 'expected all six power actions to be wired');
  });
}
