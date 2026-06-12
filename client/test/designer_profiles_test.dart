import 'package:cyberdeck_client/designer/device_class.dart';
import 'package:cyberdeck_client/designer/profiles.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ProfileManager lifecycle', () {
    test('create assigns a profile to a device class and auto-activates the first',
        () {
      final m = ProfileManager();
      final p = m.create(id: 'p1', name: 'Streaming', deviceClassId: 'tablet-landscape-10');
      expect(m.profiles, hasLength(1));
      expect(p.deviceClassId, 'tablet-landscape-10');
      // First profile for a class becomes active.
      expect(m.isActive('p1'), isTrue);
      expect(m.activeProfile('tablet-landscape-10')!.id, 'p1');
    });

    test('a second profile does not steal active, but can be activated', () {
      final m = ProfileManager();
      m.create(id: 'p1', name: 'A', deviceClassId: 'phone-portrait');
      m.create(id: 'p2', name: 'B', deviceClassId: 'phone-portrait');
      expect(m.isActive('p1'), isTrue);
      expect(m.isActive('p2'), isFalse);

      m.activate('p2');
      expect(m.activeProfile('phone-portrait')!.id, 'p2');
      expect(m.isActive('p1'), isFalse);
    });

    test('profilesFor filters by device class', () {
      final m = ProfileManager();
      m.create(id: 'p1', name: 'A', deviceClassId: 'phone-portrait');
      m.create(id: 'p2', name: 'B', deviceClassId: 'tablet-landscape-10');
      m.create(id: 'p3', name: 'C', deviceClassId: 'phone-portrait');
      expect(m.profilesFor('phone-portrait').map((p) => p.id), ['p1', 'p3']);
      expect(m.profilesFor('tablet-landscape-10').map((p) => p.id), ['p2']);
    });

    test('assign re-targets a profile and fixes active on both classes', () {
      final m = ProfileManager();
      m.create(id: 'p1', name: 'A', deviceClassId: 'phone-portrait');
      m.create(id: 'p2', name: 'B', deviceClassId: 'phone-portrait');
      // p1 active on phone. Re-assign it to the tablet class.
      m.assign('p1', 'tablet-landscape-10');
      expect(m.profile('p1')!.deviceClassId, 'tablet-landscape-10');
      // Phone's active fell to the remaining profile.
      expect(m.activeProfile('phone-portrait')!.id, 'p2');
      // Tablet adopted the re-assigned one (had none).
      expect(m.activeProfile('tablet-landscape-10')!.id, 'p1');
    });

    test('create rejects duplicate ids; activate/assign reject unknown ids', () {
      final m = ProfileManager();
      m.create(id: 'p1', name: 'A', deviceClassId: 'phone-portrait');
      expect(() => m.create(id: 'p1', name: 'X', deviceClassId: 'phone-portrait'),
          throwsArgumentError);
      expect(() => m.activate('nope'), throwsArgumentError);
      expect(() => m.assign('nope', 'phone-portrait'), throwsArgumentError);
    });

    test('notifies listeners on create/activate/assign/edit', () {
      final m = ProfileManager();
      var n = 0;
      m.addListener(() => n++);
      m.create(id: 'p1', name: 'A', deviceClassId: 'phone-portrait');
      m.create(id: 'p2', name: 'B', deviceClassId: 'phone-portrait');
      m.activate('p2');
      m.assign('p1', 'tablet-landscape-10');
      m.edit('p2');
      expect(n, 5);
    });
  });

  group('Designer ALWAYS shows the explicit target device (UI invariant)', () {
    test('targetClass is concrete before anything is opened', () {
      final m = ProfileManager();
      expect(m.targetClass, isA<DeviceClass>());
      expect(m.targetClass.id, DeviceClass.defaultClass.id);
    });

    test('editing a profile makes targetClass that profile device class', () {
      final m = ProfileManager();
      m.create(id: 'p1', name: 'A', deviceClassId: 'phone-portrait');
      m.edit('p1');
      expect(m.editingProfile!.id, 'p1');
      expect(m.targetClass.id, 'phone-portrait');
    });

    test('deviceClass lookup never returns null (falls back to default)', () {
      final m = ProfileManager();
      expect(m.deviceClass('does-not-exist').id, DeviceClass.defaultClass.id);
      expect(m.deviceClass('phone-portrait').id, 'phone-portrait');
    });

    testWidgets('a Designer-style target banner shows the target device label',
        (tester) async {
      // A minimal widget standing in for the Designer chrome: it must surface the
      // target device class explicitly — the invariant 216 guarantees.
      final m = ProfileManager();
      m.create(id: 'p1', name: 'Coding', deviceClassId: 'phone-portrait');
      m.edit('p1');
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: AnimatedBuilder(
            animation: m,
            builder: (_, _) => Text('Target: ${m.targetClass.label}',
                key: const Key('target-banner')),
          ),
        ),
      ));
      expect(find.byKey(const Key('target-banner')), findsOneWidget);
      expect(find.text('Target: ${m.deviceClass('phone-portrait').label}'),
          findsOneWidget);
    });
  });
}
