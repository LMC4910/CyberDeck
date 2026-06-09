/// Client layout-op apply path (PROJ-212, 2C §4.2). Layout ops broadcast by the
/// engine over the Layout channel are applied here, in document-version order, to
/// the renderer's [LayoutInterpreter] (PROJ-181) — which targeted-repaints only the
/// affected widget. The Layout channel is ordered/lossless, but a version gap (a
/// missed op) must NOT be replayed: the engine is the single source of truth, so a
/// gap triggers a full resync (PROJ-149) via [onResyncNeeded].
library;

import 'dart:async';
import 'dart:convert';

import '../render/render.dart';
import 'envelope.dart';

/// Applies broadcast layout ops to an interpreter in version order.
class LayoutApplier {
  LayoutApplier(
    this.interpreter, {
    required int baseVersion,
    this.onResyncNeeded,
  }) : _last = baseVersion;

  final LayoutInterpreter interpreter;

  /// Called when a version gap is detected (the client should request a full
  /// document resync rather than apply out of order).
  final void Function()? onResyncNeeded;

  int _last;

  /// The last document version applied.
  int get lastVersion => _last;

  /// Applies one broadcast layout-op envelope, honouring version ordering.
  void apply(Envelope env) {
    final Map<String, dynamic> map;
    try {
      map = jsonDecode(utf8.decode(env.payload)) as Map<String, dynamic>;
    } catch (_) {
      return; // malformed payload — ignore
    }
    final version = (map['docVersion'] as num?)?.toInt();
    if (version == null) return; // not a versioned op
    if (version <= _last) return; // duplicate / already applied
    if (version != _last + 1) {
      onResyncNeeded?.call(); // gap — do not replay; resync instead
      return;
    }
    interpreter.applyOp(LayoutOp.fromJson(map));
    _last = version;
  }

  /// Subscribes to a layout-channel envelope stream (e.g. ChannelRouter.layout).
  StreamSubscription<Envelope> bind(Stream<Envelope> layoutStream) =>
      layoutStream.listen(apply);
}
