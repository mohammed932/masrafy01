import 'dart:ui';

import '../../controller/drawing_controller.dart';

/// Base contract for every drawing tool handler.
///
/// Routed from [ToolGestureRouter] which converts raw screen pointer events
/// to image-space [Offset]s before calling these. The controller is passed
/// once at construction so handlers can read viewport / current tool state
/// + commit draft + push to history.
abstract class ToolHandler {
  ToolHandler(this.controller);

  final DrawingController controller;

  /// Called on `Listener.onPointerDown`.
  void onPointerDown(Offset imagePoint);

  /// Called on every `Listener.onPointerMove` between down + up.
  void onPointerMove(Offset imagePoint);

  /// Called on `Listener.onPointerUp` (or cancel — handlers should treat
  /// both the same).
  void onPointerUp(Offset imagePoint);

  /// Optional: fired when the tool is switched away mid-draft so it can
  /// drop its in-flight draft. Default: discard.
  void onCancel() {
    controller.activeDraft.value = null;
  }
}

/// Monotonic id generator for new annotations. `DateTime.now()` style ids
/// give chronological order without collisions inside one session.
String newAnnotationId(String prefix) =>
    '$prefix-${DateTime.now().microsecondsSinceEpoch}';
