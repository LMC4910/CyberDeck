/// PROJ-109 tray unit tests: the two platform-free seams the desktop tray rests on —
/// status mapping (engine run-state / unreachability → [TrayStatus] + tooltip + menu
/// shape) and menu-action dispatch (each [TrayAction] → the right control op, with
/// failures surfaced rather than thrown).
///
/// The dispatch tests drive a real [TrayControlClient] over an in-memory [duplexPipe]
/// against a tiny fake responder that speaks the engine's control wire byte-for-byte
/// (a length-prefixed `control` [Envelope] whose payload is `{ok, error?, data?}`),
/// so the action→op mapping is exercised end-to-end without a live engine or a native
/// tray.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:cyberdeck_client/net/conn.dart';
import 'package:cyberdeck_client/net/envelope.dart';
import 'package:cyberdeck_client/net/framing.dart';
import 'package:cyberdeck_client/tray/tray_control_client.dart';
import 'package:cyberdeck_client/tray/tray_menu.dart';
import 'package:cyberdeck_client/tray/tray_status.dart';
import 'package:flutter_test/flutter_test.dart';

/// A captured request the fake responder saw, plus how it chose to reply.
class _Exchange {
  _Exchange(this.op);
  final String op;
}

/// An in-memory stand-in for the engine's loopback control channel. For each request
/// frame it records the op, then writes a reply envelope mirroring the engine's
/// `transport.DecodeReply` shape. A reply is selected by op via [replies]; an op with
/// no mapping gets a generic `{ok:true}`.
class _FakeControlEngine {
  _FakeControlEngine({Map<String, Map<String, dynamic>>? replies})
      : _replies = replies ?? const {};

  final Map<String, Map<String, dynamic>> _replies;
  final List<_Exchange> seen = [];

  /// Wires one client-end connection to this responder; returns the client's dialer.
  ControlDialer dialer() {
    return () async {
      final (clientEnd, engineEnd) = duplexPipe();
      unawaited(_serve(FrameChannel(engineEnd)));
      return clientEnd;
    };
  }

  Future<void> _serve(FrameChannel frames) async {
    try {
      while (true) {
        final frame = await frames.read();
        if (frame == null) return;
        final req = Envelope.unmarshal(frame);
        seen.add(_Exchange(req.type));
        final reply = _replies[req.type] ?? const {'ok': true};
        final payload = Uint8List.fromList(utf8.encode(jsonEncode(reply)));
        frames.write(Envelope(
          ch: Channel.control,
          type: req.type,
          ts: DateTime.now().millisecondsSinceEpoch,
          payload: payload,
        ).marshal());
      }
    } catch (_) {
      // Pipe torn down between exchanges (each request opens a fresh connection) —
      // nothing to do; the client has its reply.
    } finally {
      await frames.close();
    }
  }
}

/// A dialer that always fails to connect, to exercise the unreachable path.
ControlDialer _deadDialer() => () async => throw Exception('connection refused');

void main() {
  group('trayStatusForState', () {
    test('running-family states map to connected', () {
      for (final s in ['running', 'Running', '  SERVING ', 'ready', 'ok']) {
        expect(trayStatusForState(s), TrayStatus.connected, reason: s);
      }
    });

    test('paused / transient states map to degraded', () {
      for (final s in ['paused', 'pausing', 'resuming', 'starting', 'draining']) {
        expect(trayStatusForState(s), TrayStatus.degraded, reason: s);
      }
    });

    test('an unknown but present state is degraded, never silently connected', () {
      expect(trayStatusForState('frobnicating'), TrayStatus.degraded);
    });

    test('error-bearing states map to error', () {
      for (final s in ['error', 'fatal: boom', 'subsystem failed']) {
        expect(trayStatusForState(s), TrayStatus.error, reason: s);
      }
    });

    test('an empty state is error (no usable run-state)', () {
      expect(trayStatusForState(''), TrayStatus.error);
      expect(trayStatusForState('   '), TrayStatus.error);
    });
  });

  test('trayStatusForUnreachable is always error', () {
    expect(trayStatusForUnreachable(), TrayStatus.error);
  });

  group('trayStatusLabel', () {
    test('base labels per status', () {
      expect(trayStatusLabel(TrayStatus.connected), 'Engine: connected');
      expect(trayStatusLabel(TrayStatus.degraded), 'Engine: degraded');
      expect(trayStatusLabel(TrayStatus.error), 'Engine: unreachable');
    });

    test('a detail is appended in parentheses; blank detail is omitted', () {
      expect(trayStatusLabel(TrayStatus.connected, detail: 'running'),
          'Engine: connected (running)');
      expect(trayStatusLabel(TrayStatus.degraded, detail: '   '),
          'Engine: degraded');
    });
  });

  group('buildTrayMenu', () {
    test('first entry is the status header, last action is Quit', () {
      final menu = buildTrayMenu(TrayStatus.connected, detail: 'running');
      expect(menu.first.label, 'Engine: connected (running)');
      final actions =
          menu.where((e) => e.action != null).map((e) => e.action).toList();
      expect(actions, contains(TrayAction.reopenUi));
      expect(actions, contains(TrayAction.pauseEngine));
      expect(actions, contains(TrayAction.showPairingQr));
      expect(actions.last, TrayAction.quitEngine);
    });

    test('when reachable, every action is enabled', () {
      final menu = buildTrayMenu(TrayStatus.connected);
      for (final e in menu.where((e) => e.action != null)) {
        expect(e.enabled, isTrue, reason: '${e.action}');
      }
    });

    test('when unreachable, Pause + Pairing-QR disable but Reopen + Quit stay', () {
      final byAction = {
        for (final e in buildTrayMenu(TrayStatus.error).where((e) => e.action != null))
          e.action!: e.enabled,
      };
      expect(byAction[TrayAction.pauseEngine], isFalse);
      expect(byAction[TrayAction.showPairingQr], isFalse);
      expect(byAction[TrayAction.reopenUi], isTrue);
      expect(byAction[TrayAction.quitEngine], isTrue);
    });
  });

  group('trayAction key round-trip', () {
    test('every action has a stable key that round-trips', () {
      for (final a in TrayAction.values) {
        expect(trayActionForKey(trayActionKey(a)), a);
        expect(trayActionLabel(a), isNotEmpty);
      }
    });

    test('an unknown key resolves to null', () {
      expect(trayActionForKey('not_a_key'), isNull);
    });
  });

  group('TrayActionDispatcher', () {
    test('Reopen UI runs the UI callback and never touches the control channel',
        () async {
      final engine = _FakeControlEngine();
      var reopened = 0;
      final dispatcher = TrayActionDispatcher(
        control: TrayControlClient(dialer: engine.dialer()),
        onReopenUi: () => reopened++,
      );

      final result = await dispatcher.dispatch(TrayAction.reopenUi);

      expect(result.success, isTrue);
      expect(reopened, 1);
      expect(engine.seen, isEmpty); // no control op for a UI-only action
    });

    test('Pause Engine dispatches the service.pause op', () async {
      final engine = _FakeControlEngine();
      final dispatcher = TrayActionDispatcher(
        control: TrayControlClient(dialer: engine.dialer()),
        onReopenUi: () {},
      );

      final result = await dispatcher.dispatch(TrayAction.pauseEngine);

      expect(result.success, isTrue);
      expect(engine.seen.single.op, ControlOp.servicePause.wire);
    });

    test('Quit Engine dispatches the service.quit op', () async {
      final engine = _FakeControlEngine();
      final dispatcher = TrayActionDispatcher(
        control: TrayControlClient(dialer: engine.dialer()),
        onReopenUi: () {},
      );

      final result = await dispatcher.dispatch(TrayAction.quitEngine);

      expect(result.success, isTrue);
      expect(engine.seen.single.op, ControlOp.serviceQuit.wire);
    });

    test('Show Pairing QR mints a token via pair.approve and returns it', () async {
      final engine = _FakeControlEngine(replies: {
        ControlOp.pairApprove.wire: {
          'ok': true,
          'data': {'token': 'one-shot-42'},
        },
      });
      final dispatcher = TrayActionDispatcher(
        control: TrayControlClient(dialer: engine.dialer()),
        onReopenUi: () {},
      );

      final result = await dispatcher.dispatch(TrayAction.showPairingQr);

      expect(result.success, isTrue);
      expect(result.token, 'one-shot-42');
      expect(engine.seen.single.op, ControlOp.pairApprove.wire);
    });

    test('an engine {ok:false} reply becomes a failed result, not a throw',
        () async {
      final engine = _FakeControlEngine(replies: {
        ControlOp.servicePause.wire: {'ok': false, 'error': 'already paused'},
      });
      final dispatcher = TrayActionDispatcher(
        control: TrayControlClient(dialer: engine.dialer()),
        onReopenUi: () {},
      );

      final result = await dispatcher.dispatch(TrayAction.pauseEngine);

      expect(result.success, isFalse);
      expect(result.message, contains('already paused'));
    });

    test('an unreachable engine surfaces a failed result, not a throw', () async {
      final dispatcher = TrayActionDispatcher(
        control: TrayControlClient(
            dialer: _deadDialer(), timeout: const Duration(milliseconds: 200)),
        onReopenUi: () {},
      );

      final result = await dispatcher.dispatch(TrayAction.quitEngine);

      expect(result.success, isFalse);
      expect(result.message, isNotEmpty);
    });
  });

  group('TrayControlClient status()', () {
    test('decodes the engine run-state label from service.status', () async {
      final engine = _FakeControlEngine(replies: {
        ControlOp.serviceStatus.wire: {
          'ok': true,
          'data': {'state': 'running'},
        },
      });
      final client = TrayControlClient(dialer: engine.dialer());

      expect(await client.status(), 'running');
      expect(engine.seen.single.op, ControlOp.serviceStatus.wire);
    });

    test('a transport failure raises a ControlChannelException', () async {
      final client = TrayControlClient(
          dialer: _deadDialer(), timeout: const Duration(milliseconds: 200));
      await expectLater(
          client.status(), throwsA(isA<ControlChannelException>()));
    });
  });
}
