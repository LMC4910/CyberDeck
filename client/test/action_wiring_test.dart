// Guards the launch/volume wiring (PROJ — real plugin functions): the authored
// pages must address the engine's REAL generic action ids — `launch.url`/`launch.app`
// (+ a target param) and `volume.set`/`volume.mute` — not the old app-specific ids
// the registry never knew (which silently audited `interaction.rejected`). A walk
// over all 7 seed pages asserts every action in the backed namespaces resolves, so
// a future typo or a half-wired tile fails the build instead of failing silently.
import 'package:cyberdeck_client/data/mock_deck_source.dart';
import 'package:cyberdeck_client/data/pages/builders.dart';
import 'package:cyberdeck_client/data/seed_decks.dart';
import 'package:cyberdeck_client/gestures/slots.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  // The action ids the engine registry actually routes to a real plugin
  // (engine/cmd/cyberdeck/main.go builtinLookup).
  const liveLaunch = {'launch.url', 'launch.app'};
  const liveVolume = {'volume.set', 'volume.mute', 'volume.app.set'};
  const livePower = {
    'system.shutdown',
    'system.restart',
    'system.sleep',
    'system.hibernate',
    'system.lock',
    'system.logoff',
  };
  const liveMedia = {
    'media.transport.playPause',
    'media.transport.next',
    'media.transport.previous',
  };
  // Smart Home actions handled locally in Demo + by the live home.* plugin.
  const liveHomeToggle = {
    'home.room.living.toggle',
    'home.room.bedroom.toggle',
    'home.room.kitchen.toggle',
    'home.room.office.toggle',
    'home.room.bathroom.toggle',
    'home.lights.ceiling.toggle',
    'home.lights.floor.toggle',
    'home.tv.toggle',
    'home.speaker.toggle',
    'home.ac.toggle',
    'home.coffee.toggle',
    'home.auto.sunset.toggle',
  };
  const liveHomeScene = {
    'home.scene.goodnight',
    'home.scene.movie',
    'home.scene.party',
    'home.scene.focus',
    'home.scene.morning',
    'home.scene.away',
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
          if (t.ref.startsWith('media.transport.')) {
            expect(liveMedia.contains(t.ref), isTrue,
                reason: '${node.id} uses unknown media transport id "${t.ref}"');
          }
          if (t.ref.startsWith('home.') && t.ref.endsWith('.toggle')) {
            expect(liveHomeToggle.contains(t.ref), isTrue,
                reason: '${node.id} uses unknown home toggle id "${t.ref}"');
          }
          if (t.ref.startsWith('home.scene.')) {
            expect(liveHomeScene.contains(t.ref), isTrue,
                reason: '${node.id} uses unknown home scene id "${t.ref}"');
          }
        }
      }
    }

    // Sanity: the wiring actually happened — both launch forms, both volume
    // actions, all six power actions, and the media transport set are present.
    expect(seen.containsAll(liveLaunch), isTrue,
        reason: 'expected both launch.url and launch.app to be wired');
    expect(seen.containsAll(liveVolume), isTrue,
        reason: 'expected both volume.set and volume.mute to be wired');
    expect(seen.containsAll(livePower), isTrue,
        reason: 'expected all six power actions to be wired');
    expect(seen.containsAll(liveMedia), isTrue,
        reason: 'expected media transport (playPause/next/previous) to be wired');
    expect(seen.containsAll(liveHomeToggle), isTrue,
        reason: 'expected all Smart Home toggle actions to be wired');
    expect(seen.containsAll(liveHomeScene), isTrue,
        reason: 'expected all Smart Home scene actions to be wired');
  });

  group('Smart Home Demo wiring', () {
    test('seedInitialState carries the room + device booleans', () {
      final s = seedInitialState();
      for (final id in const [
        'home.room.living',
        'home.room.bedroom',
        'home.room.kitchen',
        'home.room.office',
        'home.room.bathroom',
      ]) {
        expect(s.containsKey(id), isTrue, reason: '$id must be seeded');
        expect(s[id], isA<bool>(), reason: '$id must be a boolean');
      }
      // Room defaults match the contract (living/kitchen/office on; others off).
      expect(s['home.room.living'], true);
      expect(s['home.room.bedroom'], false);
      expect(s['home.room.kitchen'], true);
      expect(s['home.room.office'], true);
      expect(s['home.room.bathroom'], false);
      // Device booleans were already seeded — keep them honest too.
      for (final id in const [
        'home.lights.ceiling',
        'home.lights.floor',
        'home.tv',
        'home.speaker',
        'home.ac',
        'home.coffee',
        'home.auto.sunset',
      ]) {
        expect(s[id], isA<bool>(), reason: '$id must be a seeded boolean');
      }
    });

    test('dispatching a home.*.toggle flips the bound boolean in Demo', () async {
      final src = MockDeckSource();
      addTearDown(src.dispose);

      // home.lights.ceiling seeds true → toggling flips it to false. The mock
      // emits every _set as a StateUpdate; track the latest value for the id.
      Object? ceiling;
      final sub = src.states().listen((u) {
        if (u.id == 'home.lights.ceiling') ceiling = u.value;
      });
      addTearDown(sub.cancel);

      // Let the snapshot burst (seeded `true`) flush to the listener first.
      await Future<void>.delayed(Duration.zero);
      expect(ceiling, true);

      await src.invoke('home.lights.ceiling.toggle');
      await Future<void>.delayed(Duration.zero);
      expect(ceiling, false);

      await src.invoke('home.lights.ceiling.toggle');
      await Future<void>.delayed(Duration.zero);
      expect(ceiling, true);
    });
  });
}
