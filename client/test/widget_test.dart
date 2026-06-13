// Demo-Mode journey tests: the app is fully exercisable with no engine. Screen-level
// tests drive a MockDeckSource directly and use explicit pump() — never
// pumpAndSettle, since the mock's periodic ticker never "settles". Each test unmounts
// the tree and disposes the source before returning so no timer stays pending.

import 'package:cyberdeck_client/app/deck.dart';
import 'package:cyberdeck_client/app/deck_list.dart';
import 'package:cyberdeck_client/app/landing.dart';
import 'package:cyberdeck_client/data/mock_deck_source.dart';
import 'package:cyberdeck_client/designer/deck_editor.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> _teardown(WidgetTester tester, MockDeckSource source) async {
  await tester.pumpWidget(const SizedBox()); // unmount listeners
  await source.dispose(); // cancel the telemetry timer
  tester.view.resetPhysicalSize();
  tester.view.resetDevicePixelRatio();
}

/// The rich Home "Control Center" deck is authored for a wide control-surface
/// display; size the test view to a representative desktop window so its dense
/// 24x16 grid lays its cards out without overflow (the default 800x600 test
/// surface is far smaller than any real deck).
void _useDeckSurface(WidgetTester tester) {
  tester.view.devicePixelRatio = 1.0;
  tester.view.physicalSize = const Size(1920, 1200);
}

void main() {
  testWidgets('landing offers Demo Mode and Connect', (tester) async {
    var demo = false;
    await tester.pumpWidget(MaterialApp(
      home: LandingScreen(onDemo: () => demo = true, onConnect: () {}),
    ));
    expect(find.byKey(const Key('landing-demo')), findsOneWidget);
    expect(find.byKey(const Key('landing-connect')), findsOneWidget);
    await tester.tap(find.byKey(const Key('landing-demo')));
    expect(demo, isTrue);
  });

  testWidgets('deck list shows the seed decks and opens one', (tester) async {
    final source = MockDeckSource();
    String? opened;
    await tester.pumpWidget(MaterialApp(
      home: DeckListScreen(source: source, onOpen: (id) => opened = id),
    ));
    await tester.pump();
    expect(find.text('Dashboard'), findsOneWidget);
    expect(find.text('Media'), findsOneWidget);
    expect(find.text('Smart Home'), findsOneWidget);

    await tester.tap(find.byKey(const Key('deck-card-dashboard')));
    expect(opened, 'dashboard');
    await _teardown(tester, source);
  });

  testWidgets('deck renders live gauges and a button gives feedback',
      (tester) async {
    _useDeckSurface(tester);
    final source = MockDeckSource();
    await tester.pumpWidget(MaterialApp(
      home: DeckScreen(source: source, deckId: 'dashboard'),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.byKey(const Key('gauge-value-dash.cpu.gauge')), findsOneWidget);

    // The Terminal control tile is non-destructive: a single tap gives feedback.
    expect(find.text('Terminal'), findsOneWidget);
    await tester.tap(find.text('Terminal'));
    await tester.pump();
    await tester.pump();
    expect(find.text('Launching Terminal'), findsOneWidget);
    await _teardown(tester, source);
  });

  testWidgets('destructive action requires a second confirming tap',
      (tester) async {
    _useDeckSurface(tester);
    final source = MockDeckSource();
    await tester.pumpWidget(MaterialApp(
      home: DeckScreen(source: source, deckId: 'dashboard'),
    ));
    await tester.pump(const Duration(milliseconds: 100));

    await tester.tap(find.text('Lock System')); // armed, not executed
    await tester.pump();
    await tester.pump();
    expect(find.textContaining('Tap again to confirm'), findsOneWidget);

    await tester.tap(find.text('Lock System')); // confirm → executes
    await tester.pump();
    await tester.pump();
    expect(find.text('Locked (demo)'), findsOneWidget);
    await _teardown(tester, source);
  });

  testWidgets('designer: select a widget then remove it', (tester) async {
    _useDeckSurface(tester);
    final source = MockDeckSource();
    await tester.pumpWidget(MaterialApp(
      home: DeckEditor(source: source, deckId: 'dashboard'),
    ));
    await tester.pump();

    await tester.ensureVisible(find.byKey(const Key('edit-hit-dash.ctl.lock')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('edit-hit-dash.ctl.lock')));
    await tester.pump();
    expect(find.byKey(const Key('editor-label-dash.ctl.lock')), findsOneWidget);

    await tester.tap(find.byKey(const Key('editor-remove')));
    await tester.pump();
    expect(find.byKey(const Key('edit-hit-dash.ctl.lock')), findsNothing);
    await _teardown(tester, source);
  });
}
