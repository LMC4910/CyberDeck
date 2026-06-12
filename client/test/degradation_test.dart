// PROJ-188 degradation UI: on disconnect the deck keeps rendering each bound
// widget's LAST value but DIMMED with a stale-link banner; never-received
// capabilities show "--" (never fabricated); on reconnect the deck clears
// degradation and resumes live values at full brightness.

import 'package:cyberdeck_client/app/connection_badge.dart';
import 'package:cyberdeck_client/data/deck_source.dart';
import 'package:cyberdeck_client/render/degradation.dart';
import 'package:cyberdeck_client/render/render.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

LayoutPage _page() => const LayoutPage(id: 'p', widgets: [
      WidgetNode(
        id: 'cpu',
        type: 'label',
        placement: Placement(col: 0, row: 0),
        appearance: Appearance(style: {'label': 'CPU'}, stateBinding: 'system.cpu'),
      ),
      WidgetNode(
        id: 'gpu',
        type: 'label',
        placement: Placement(col: 0, row: 1),
        appearance: Appearance(style: {'label': 'GPU'}, stateBinding: 'system.gpu'),
      ),
    ]);

Future<LayoutInterpreter> _pump(WidgetTester tester) async {
  final interp = LayoutInterpreter(registry: RendererRegistry.withBuiltins())
    ..load(_page());
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(
      body: SizedBox(width: 800, height: 600, child: interp.build()),
    ),
  ));
  addTearDown(interp.dispose);
  return interp;
}

Opacity _deckOpacity(WidgetTester tester) {
  return tester.widget<Opacity>(find.descendant(
    of: find.byKey(const Key('degradation-overlay')),
    matching: find.byType(Opacity),
  ));
}

void main() {
  testWidgets('disconnect dims the deck over its last value + shows the banner',
      (tester) async {
    final interp = await _pump(tester);
    interp.applyState('system.cpu', 42);
    await tester.pump();

    // Live: full brightness, no overlay/banner.
    expect(find.text('CPU: 42'), findsOneWidget);
    expect(find.byKey(const Key('degradation-overlay')), findsNothing);
    expect(find.byKey(const Key('degradation-banner')), findsNothing);

    // Disconnect.
    interp.setDegraded(true);
    await tester.pump();

    // Last value is still shown (not frozen out, not blanked) — just dimmed.
    expect(find.text('CPU: 42'), findsOneWidget);
    expect(find.byKey(const Key('degradation-banner')), findsOneWidget);
    expect(_deckOpacity(tester).opacity, kDegradedOpacity);
  });

  testWidgets('an unavailable capability shows "--" (never fabricated)',
      (tester) async {
    final interp = await _pump(tester);
    interp.applyState('system.cpu', 42); // gpu never received
    interp.setDegraded(true);
    await tester.pump();

    // CPU keeps its last real value; GPU was never received → "--", not a guess.
    expect(find.text('CPU: 42'), findsOneWidget);
    expect(find.text('GPU: --'), findsOneWidget);
  });

  testWidgets('reconnect clears degradation and resumes live at full brightness',
      (tester) async {
    final interp = await _pump(tester);
    interp.applyState('system.cpu', 42);
    interp.setDegraded(true);
    await tester.pump();
    expect(find.byKey(const Key('degradation-banner')), findsOneWidget);

    // Reconnect: clear degradation, then a fresh live update flows through.
    interp.setDegraded(false);
    interp.applyState('system.cpu', 7);
    await tester.pump();

    expect(find.byKey(const Key('degradation-overlay')), findsNothing);
    expect(find.byKey(const Key('degradation-banner')), findsNothing);
    expect(find.text('CPU: 7'), findsOneWidget);
  });

  test('isDegradedStatus maps only a dropped live link to degraded', () {
    expect(isDegradedStatus(ConnStatus.disconnected), isTrue);
    expect(isDegradedStatus(ConnStatus.connected), isFalse);
    expect(isDegradedStatus(ConnStatus.connecting), isFalse);
    expect(isDegradedStatus(ConnStatus.demo), isFalse); // demo is not degraded
  });

  testWidgets('ConnectionBadge reflects status changes', (tester) async {
    final status = ValueNotifier<ConnStatus>(ConnStatus.connected);
    addTearDown(status.dispose);
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: ConnectionBadge(status)),
    ));
    expect(find.text('live'), findsOneWidget);

    status.value = ConnStatus.disconnected;
    await tester.pump();
    expect(find.text('offline'), findsOneWidget);
  });
}
