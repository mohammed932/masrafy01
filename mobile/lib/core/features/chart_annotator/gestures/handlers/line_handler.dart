import 'dart:ui';

import '../../model/annotation.dart';
import 'tool_handler.dart';

/// Drag from start to end → one `LineAnnotation`.
class LineHandler extends ToolHandler {
  LineHandler(super.controller);

  Offset? _start;

  @override
  void onPointerDown(Offset imagePoint) {
    _start = imagePoint;
    controller.activeDraft.value = LineAnnotation(
      id: newAnnotationId(LineAnnotation.kType),
      start: imagePoint,
      end: imagePoint,
    );
  }

  @override
  void onPointerMove(Offset imagePoint) {
    final start = _start;
    if (start == null) return;
    controller.activeDraft.value = LineAnnotation(
      id: newAnnotationId(LineAnnotation.kType),
      start: start,
      end: imagePoint,
    );
  }

  @override
  void onPointerUp(Offset imagePoint) {
    final start = _start;
    _start = null;
    if (start == null) return;
    if ((imagePoint - start).distance < 2) {
      controller.activeDraft.value = null;
      return;
    }
    final annotation = LineAnnotation(
      id: newAnnotationId(LineAnnotation.kType),
      start: start,
      end: imagePoint,
    );
    controller.activeDraft.value = null;
    controller.commit([...controller.committed.value, annotation]);
  }
}
