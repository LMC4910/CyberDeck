import 'package:cyberdeck_client/gestures/gestures.dart';
import 'package:cyberdeck_client/render/render.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('interaction targets', () {
    test('parses a widget interaction slot', () {
      const node = WidgetNode(
        id: 'w1',
        type: 'button',
        placement: Placement(col: 0, row: 0),
        interaction: {
          'tap': {'target': 'action', 'ref': 'media.play'},
          'longPress': {'target': 'flow', 'ref': 'flow_morning'},
        },
      );
      final tap = interactionFor(node, Slots.tap)!;
      expect(tap.kind, 'action');
      expect(tap.ref, 'media.play');
      expect(interactionFor(node, Slots.longPress)!.kind, 'flow');
      expect(interactionFor(node, Slots.doubleTap), isNull);
    });
  });

  group('TwoTapConfirmer', () {
    test('non-destructive action executes on the first tap', () {
      final c = TwoTapConfirmer(isDestructive: (_) => false);
      final o = c.activate('media.play');
      expect(o.execute, isTrue);
      expect(o.armed, isFalse);
    });

    test('destructive action arms then executes on a second tap', () {
      final c = TwoTapConfirmer(isDestructive: (ref) => ref == 'system.shutdown');
      final first = c.activate('system.shutdown');
      expect(first.execute, isFalse);
      expect(first.armed, isTrue);
      expect(c.armedRef, 'system.shutdown');

      final second = c.activate('system.shutdown');
      expect(second.execute, isTrue);
      expect(c.armedRef, isNull); // disarmed after confirm
    });

    test('a second tap after the window re-arms instead of executing', () {
      var now = DateTime(2026, 1, 1, 12, 0, 0);
      final c = TwoTapConfirmer(
        isDestructive: (_) => true,
        window: const Duration(seconds: 3),
        clock: () => now,
      );
      expect(c.activate('x').armed, isTrue);
      now = now.add(const Duration(seconds: 5)); // past the window
      final o = c.activate('x');
      expect(o.execute, isFalse);
      expect(o.armed, isTrue); // re-armed
    });

    test('activating a different action resets the armed one', () {
      final c = TwoTapConfirmer(isDestructive: (_) => true);
      c.activate('a');
      final o = c.activate('b');
      expect(o.armed, isTrue);
      expect(c.armedRef, 'b');
    });
  });

  group('GestureCapture', () {
    Future<List<String>> pumpCapture(WidgetTester tester) async {
      final slots = <String>[];
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Center(
            child: GestureCapture(
              onSlot: slots.add,
              child: const SizedBox(width: 200, height: 200),
            ),
          ),
        ),
      ));
      return slots;
    }

    testWidgets('tap / longPress dispatch their slots + pressed-state', (tester) async {
      final slots = await pumpCapture(tester);

      final g = await tester.startGesture(
          tester.getCenter(find.byType(GestureCapture)));
      await tester.pump();
      expect(find.byKey(const Key('gesture-pressed')), findsOneWidget); // ≤100ms
      await g.up();
      // Let the double-tap recogniser time out so the single tap resolves.
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.byKey(const Key('gesture-pressed')), findsNothing);
      expect(slots, contains(Slots.pressDown));
      expect(slots, contains(Slots.pressUp));
      expect(slots, contains(Slots.tap));

      await tester.longPress(find.byType(GestureCapture));
      await tester.pump();
      expect(slots, contains(Slots.longPress));
    });

    testWidgets('a fling dispatches a swipe slot', (tester) async {
      final slots = await pumpCapture(tester);
      await tester.fling(
          find.byType(GestureCapture), const Offset(-300, 0), 1000);
      await tester.pump();
      expect(slots, contains(Slots.swipeLeft));
    });
  });
}
