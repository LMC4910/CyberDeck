/// Gesture capture across interaction slots + two-tap confirm (PROJ-187, 2C §3).
/// Maps device gestures to interaction-slot events and gates destructive actions
/// behind a 2-tap confirmation.
library;

export 'capture.dart';
export 'confirm.dart';
export 'slots.dart';
