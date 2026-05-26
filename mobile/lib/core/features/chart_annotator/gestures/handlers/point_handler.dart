import 'dart:ui';

import '../../model/annotation.dart';
import 'tool_handler.dart';

class PointHandler extends ToolHandler {
  PointHandler(super.controller);

  @override
  void onPointerDown(Offset imagePoint) {
    // Commit immediately on tap-down — no draft needed.
    final annotation = PointAnnotation(
      id: newAnnotationId(PointAnnotation.kType),
      position: imagePoint,
    );
    controller.commit([...controller.committed.value, annotation]);
  }

  @override
  void onPointerMove(Offset imagePoint) {}

  @override
  void onPointerUp(Offset imagePoint) {}
}
