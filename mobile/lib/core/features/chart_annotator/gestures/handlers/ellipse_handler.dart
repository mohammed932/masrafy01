import 'dart:ui';

import '../../model/annotation.dart';
import 'tool_handler.dart';

class EllipseHandler extends ToolHandler {
  EllipseHandler(super.controller);

  Offset? _start;

  @override
  void onPointerDown(Offset imagePoint) {
    _start = imagePoint;
    controller.activeDraft.value = EllipseAnnotation(
      id: newAnnotationId(EllipseAnnotation.kType),
      rect: Rect.fromPoints(imagePoint, imagePoint),
    );
  }

  @override
  void onPointerMove(Offset imagePoint) {
    final start = _start;
    if (start == null) return;
    controller.activeDraft.value = EllipseAnnotation(
      id: newAnnotationId(EllipseAnnotation.kType),
      rect: Rect.fromPoints(start, imagePoint),
    );
  }

  @override
  void onPointerUp(Offset imagePoint) {
    final start = _start;
    _start = null;
    if (start == null) return;
    final rect = Rect.fromPoints(start, imagePoint);
    if (rect.width < 4 || rect.height < 4) {
      controller.activeDraft.value = null;
      return;
    }
    final annotation = EllipseAnnotation(
      id: newAnnotationId(EllipseAnnotation.kType),
      rect: rect,
    );
    controller.activeDraft.value = null;
    controller.commit([...controller.committed.value, annotation]);
  }
}
