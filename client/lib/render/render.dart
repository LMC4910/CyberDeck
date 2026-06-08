/// Client rendering layer (PROJ-181, 2C §7 / ADR-0003): the deterministic renderer
/// of the host-authored layout document — model, renderer registry, layout
/// interpreter, client state store, and ops. The Designer canvas reuses this same
/// renderer so "what you design is what the device shows" holds by construction
/// (never fork the renderer). Built-in widgets (button/toggle/…) register on this
/// registry in PROJ-182–186.
library;

export 'interpreter.dart';
export 'model.dart';
export 'ops.dart';
export 'registry.dart';
export 'state_store.dart';
