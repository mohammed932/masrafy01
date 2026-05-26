import 'dart:ui';

import '../../model/annotation.dart';
import 'tool_handler.dart';

/// Axis-snapped single-drag line — matches Angular `attachment-editor` impl
/// (`updatePerpendicularLine`): during drag, lock the end-point to whichever
/// axis the user moved more.
class PerpendicularHandler extends ToolHandler {
  PerpendicularHandler(super.controller);

  Offset? _start;

  Offset _snap(Offset start, Offset current) {
    final dx = (current.dx - start.dx).abs();
    final dy = (current.dy - start.dy).abs();
    return dx > dy
        ? Offset(current.dx, start.dy)
        : Offset(start.dx, current.dy);
  }

  @override
  void onPointerDown(Offset imagePoint) {
    _start = imagePoint;
    controller.activeDraft.value = PerpendicularAnnotation(
      id: newAnnotationId(PerpendicularAnnotation.kType),
      start: imagePoint,
      end: imagePoint,
    );
  }

  @override
  void onPointerMove(Offset imagePoint) {
    final start = _start;
    if (start == null) return;
    controller.activeDraft.value = PerpendicularAnnotation(
      id: newAnnotationId(PerpendicularAnnotation.kType),
      start: start,
      end: _snap(start, imagePoint),
    );
  }

  @override
  void onPointerUp(Offset imagePoint) {
    final start = _start;
    _start = null;
    if (start == null) return;
    final end = _snap(start, imagePoint);
    if ((end - start).distance < 2) {
      controller.activeDraft.value = null;
      return;
    }
    final annotation = PerpendicularAnnotation(
      id: newAnnotationId(PerpendicularAnnotation.kType),
      start: start,
      end: end,
    );
    controller.activeDraft.value = null;
    controller.commit([...controller.committed.value, annotation]);
  }

  @override
  void onCancel() {
    _start = null;
    super.onCancel();
  }
}
