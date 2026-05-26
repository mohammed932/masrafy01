import 'dart:ui';

import '../../model/annotation.dart';
import 'tool_handler.dart';

/// Persistent crosshair marker. Each tap (or tap-release after a drag)
/// commits a [CrosshairAnnotation] at the pointer position. Draft updates
/// during drag so the user can position before releasing.
class CrosshairHandler extends ToolHandler {
  CrosshairHandler(super.controller);

  Offset? _pendingPosition;

  @override
  void onPointerDown(Offset imagePoint) {
    _pendingPosition = imagePoint;
    controller.crosshairPosition.value = imagePoint;
    controller.activeDraft.value = CrosshairAnnotation(
      id: newAnnotationId(CrosshairAnnotation.kType),
      position: imagePoint,
    );
  }

  @override
  void onPointerMove(Offset imagePoint) {
    _pendingPosition = imagePoint;
    controller.crosshairPosition.value = imagePoint;
    controller.activeDraft.value = CrosshairAnnotation(
      id: newAnnotationId(CrosshairAnnotation.kType),
      position: imagePoint,
    );
  }

  @override
  void onPointerUp(Offset imagePoint) {
    final pos = _pendingPosition ?? imagePoint;
    _pendingPosition = null;
    controller.crosshairPosition.value = null;
    controller.activeDraft.value = null;
    final annotation = CrosshairAnnotation(
      id: newAnnotationId(CrosshairAnnotation.kType),
      position: pos,
    );
    controller.commit([...controller.committed.value, annotation]);
  }

  @override
  void onCancel() {
    _pendingPosition = null;
    controller.crosshairPosition.value = null;
    super.onCancel();
  }
}
