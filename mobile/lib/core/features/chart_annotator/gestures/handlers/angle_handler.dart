import 'dart:ui';

import '../../model/annotation.dart';
import 'tool_handler.dart';

/// Three-gesture angle measurement.
///
/// Each pointer-down → drag → pointer-up gesture defines exactly one of the
/// three control points:
///   * Gesture 1 → `vertex`
///   * Gesture 2 → `rayA`
///   * Gesture 3 → `rayB` + commits on release
///
/// Drag during a gesture previews the point following the finger; release
/// locks it. Pure tap (no drag) and tap-hold-drag both work because the
/// "active" point is updated on every `onPointerMove`.
class AngleHandler extends ToolHandler {
  AngleHandler(super.controller);

  Offset? _vertex;
  Offset? _rayA;
  Offset? _rayB;

  @override
  void onPointerDown(Offset imagePoint) {
    if (_vertex == null) {
      _vertex = imagePoint;
    } else if (_rayA == null) {
      _rayA = imagePoint;
    } else {
      _rayB = imagePoint;
    }
    _refreshDraft();
  }

  @override
  void onPointerMove(Offset imagePoint) {
    if (_vertex == null) return;
    if (_rayB != null) {
      _rayB = imagePoint;
    } else if (_rayA != null) {
      _rayA = imagePoint;
    } else {
      _vertex = imagePoint;
    }
    _refreshDraft();
  }

  @override
  void onPointerUp(Offset imagePoint) {
    if (_rayB == null) return;
    // 3rd gesture completed → commit.
    final vertex = _vertex!;
    final rayA = _rayA!;
    final rayB = _rayB!;
    _vertex = null;
    _rayA = null;
    _rayB = null;
    controller.activeDraft.value = null;
    final annotation = AngleAnnotation(
      id: newAnnotationId(AngleAnnotation.kType),
      vertex: vertex,
      rayA: rayA,
      rayB: rayB,
    );
    controller.commit([...controller.committed.value, annotation]);
  }

  void _refreshDraft() {
    final vertex = _vertex;
    if (vertex == null) {
      controller.activeDraft.value = null;
      return;
    }
    controller.activeDraft.value = AngleAnnotation(
      id: newAnnotationId(AngleAnnotation.kType),
      vertex: vertex,
      rayA: _rayA ?? vertex,
      rayB: _rayB ?? _rayA ?? vertex,
    );
  }

  @override
  void onCancel() {
    _vertex = null;
    _rayA = null;
    _rayB = null;
    super.onCancel();
  }
}
