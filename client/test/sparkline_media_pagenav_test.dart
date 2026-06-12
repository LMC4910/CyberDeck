import 'package:cyberdeck_client/render/render.dart';
import 'package:cyberdeck_client/render/widgets/media_card.dart';
import 'package:cyberdeck_client/render/widgets/sparkline.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Pumps a single full-box widget on a 1x1 grid (so the widget fills the test
/// area) with an interaction sink that records `id:slot=value` events.
Future<({List<String> events, LayoutInterpreter interp})> pumpOne(
  WidgetTester tester,
  WidgetNode node,
) async {
  final events = <String>[];
  final interp = LayoutInterpreter(registry: RendererRegistry.withBuiltins())
    ..interactionSink =
        (n, slot, {value}) => events.add('${n.id}:$slot=$value');
  interp.load(LayoutPage(
    id: 'p',
    grid: const GridConfig(columns: 1, rows: 1, gutter: 0, marginX: 0, marginY: 0),
    widgets: [node],
  ));
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(
      body: SizedBox(width: 300, height: 300, child: interp.build()),
    ),
  ));
  await tester.pump();
  return (events: events, interp: interp);
}

WidgetNode node(
  String id,
  String type, {
  String? binding,
  Map<String, dynamic> style = const {},
  Map<String, dynamic> config = const {},
}) =>
    WidgetNode(
      id: id,
      type: type,
      placement: const Placement(col: 0, row: 0),
      appearance: Appearance(style: style, stateBinding: binding),
      config: config,
    );

void main() {
  group('PROJ-185 sparkline', () {
    test('seriesFromValue coerces a List, ignores non-numerics, null for scalar', () {
      expect(seriesFromValue([1, 2.5, '3']), [1.0, 2.5, 3.0]);
      expect(seriesFromValue([1, 'x', 2]), [1.0, 2.0]); // non-numeric dropped
      expect(seriesFromValue(42), isNull); // scalar is appended, not a series
      expect(seriesFromValue(null), isNull);
    });

    testWidgets('renders a bound series state', (tester) async {
      final r = await pumpOne(
        tester,
        node('sp1', 'sparkline', binding: 's.series'),
      );
      r.interp.applyState('s.series', <num>[10, 20, 15, 30]);
      await tester.pump();
      expect(find.byKey(const Key('sparkline-sp1')), findsOneWidget);
      expect(find.byKey(const Key('sparkline-paint-sp1')), findsOneWidget);
      expect(find.byKey(const Key('unknown-widget-placeholder')), findsNothing);
    });

    testWidgets('appends scalar deltas to a rolling window (series rides state)',
        (tester) async {
      final r = await pumpOne(
        tester,
        node('sp2', 'sparkline', binding: 's.cpu', config: {'capacity': 3}),
      );
      // Each scalar delta is appended; the painter's series grows then rolls.
      r.interp.applyState('s.cpu', 10);
      await tester.pump();
      _SeriesProbe.expectSeries(tester, 'sp2', [10.0]);

      r.interp.applyState('s.cpu', 20);
      await tester.pump();
      _SeriesProbe.expectSeries(tester, 'sp2', [10.0, 20.0]); // appended

      r.interp.applyState('s.cpu', 30);
      await tester.pump();
      r.interp.applyState('s.cpu', 40); // exceeds capacity 3 → oldest dropped
      await tester.pump();
      _SeriesProbe.expectSeries(tester, 'sp2', [20.0, 30.0, 40.0]);
    });
  });

  group('PROJ-186 media card', () {
    test('mediaInfoFromValue parses a Map payload and a plain title', () {
      final n = node('m', 'media.card');
      final fromMap = mediaInfoFromValue(
          {'track': 'Neon', 'artist': 'Synth', 'playing': true}, n);
      expect(fromMap.track, 'Neon');
      expect(fromMap.artist, 'Synth');
      expect(fromMap.playing, isTrue);

      final fromStr = mediaInfoFromValue('Just A Title', n);
      expect(fromStr.track, 'Just A Title');
      expect(fromStr.playing, isFalse);

      final none = mediaInfoFromValue(null, n);
      expect(none.track, '--');
    });

    testWidgets('renders track/artist and emits transport slots', (tester) async {
      final r = await pumpOne(
        tester,
        node('mc1', 'media.card', binding: 'media.nowplaying'),
      );
      r.interp.applyState('media.nowplaying',
          {'track': 'Neon Drive', 'artist': 'Carpenter', 'playing': false});
      await tester.pump();

      expect(find.byKey(const Key('media-card-mc1')), findsOneWidget);
      expect(find.text('Neon Drive'), findsOneWidget);
      expect(find.text('Carpenter'), findsOneWidget);
      // Not playing → shows the play icon.
      expect(find.byIcon(Icons.play_arrow), findsOneWidget);

      await tester.tap(find.byKey(const Key('media-playPause-mc1')));
      await tester.pump();
      expect(r.events, contains('mc1:playPause=null'));

      await tester.tap(find.byKey(const Key('media-next-mc1')));
      await tester.pump();
      expect(r.events, contains('mc1:next=null'));

      await tester.tap(find.byKey(const Key('media-previous-mc1')));
      await tester.pump();
      expect(r.events, contains('mc1:previous=null'));
    });

    testWidgets('shows the pause icon while playing', (tester) async {
      final r = await pumpOne(
        tester,
        node('mc2', 'media.card', binding: 'media.nowplaying'),
      );
      r.interp.applyState('media.nowplaying', {'track': 'X', 'playing': true});
      await tester.pump();
      expect(find.byIcon(Icons.pause), findsOneWidget);
    });
  });

  group('PROJ-186 page-nav', () {
    testWidgets('emits navigate with its target on tap', (tester) async {
      final r = await pumpOne(
        tester,
        node('nav1', 'page.nav',
            style: {'label': 'Audio'}, config: {'target': 'page.audio'}),
      );
      expect(find.byKey(const Key('page-nav-nav1')), findsOneWidget);
      expect(find.text('Audio'), findsOneWidget);

      await tester.tap(find.byKey(const Key('page-nav-nav1')));
      await tester.pump();
      expect(r.events, contains('nav1:navigate=page.audio'));
    });

    testWidgets('emits navigate with null target when none configured',
        (tester) async {
      final r = await pumpOne(tester, node('nav2', 'page.nav'));
      await tester.tap(find.byKey(const Key('page-nav-nav2')));
      await tester.pump();
      expect(r.events, contains('nav2:navigate=null'));
    });
  });
}

/// Reads a sparkline's live painter series so append-on-delta is asserted on the
/// actual rendered trace (not just the public coercion helper).
abstract final class _SeriesProbe {
  static void expectSeries(WidgetTester tester, String id, List<double> want) {
    final cp = tester.widget<CustomPaint>(
      find.byKey(Key('sparkline-paint-$id')),
    );
    final painter = cp.painter!;
    // The painter is private; assert its series via its debug string render by
    // repainting against a candidate and checking equality through shouldRepaint.
    final series = _seriesOf(painter);
    expect(series, want);
  }

  static List<double> _seriesOf(CustomPainter painter) {
    // Access the `series` field reflectively via toString is brittle; instead the
    // painter exposes equality through shouldRepaint against a probe. We rebuild a
    // matching painter for each candidate isn't possible without the type, so we
    // read through the dynamic field which Dart permits on the concrete instance.
    final dynamic p = painter;
    final s = p.series as List<double>;
    return List<double>.of(s);
  }
}
