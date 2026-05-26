import 'dart:ui';

import '../../model/annotation.dart';
import 'tool_handler.dart';

/// Single-tap → spawns an inline `TextField` overlay via the
/// `TextEditorOverlay` widget; commit fires via [onTextSubmitted].
///
/// The widget tree pumps tap-locations into this handler. The handler
/// forwards them upstream — `ChartAnnotator` listens for [pendingPosition]
/// changes and pushes the overlay.
class TextHandler extends ToolHandler {
  TextHandler(super.controller);

  Offset? _pendingPosition;
  void Function(Offset imagePoint)? onTapAtImagePoint;

  @override
  void onPointerDown(Offset imagePoint) {
    _pendingPosition = imagePoint;
    onTapAtImagePoint?.call(imagePoint);
  }

  @override
  void onPointerMove(Offset imagePoint) {}

  @override
  void onPointerUp(Offset imagePoint) {}

  /// Called by the overlay when the user submits non-empty text. Commits a
  /// new [TextAnnotation] and clears the pending position.
  void commitText(String text) {
    final pos = _pendingPosition;
    _pendingPosition = null;
    if (pos == null || text.trim().isEmpty) return;
    final annotation = TextAnnotation(
      id: newAnnotationId(TextAnnotation.kType),
      position: pos,
      text: text,
    );
    controller.commit([...controller.committed.value, annotation]);
  }

  void discard() {
    _pendingPosition = null;
  }
}
