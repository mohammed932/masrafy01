import 'dart:ui';

import '../../model/annotation.dart';
import 'tool_handler.dart';

enum _SelectMode { idle, move, resize }

/// Hit-tests committed annotations (top-down) on pointer-down. Subsequent
/// pointer moves either translate (drag-body) or resize (drag-handle) the
/// selected annotation. Resize maps the 8 handle indices to corner / edge
/// transformations of the annotation's `boundsInImageSpace` rect, then
/// delegates to [Annotation.resize].
class SelectHandler extends ToolHandler {
  SelectHandler(super.controller);

  static const double _handleHitSlop = 16;

  Offset? _lastPoint;
  Annotation? _draggingFrom;
  Rect _initialBounds = Rect.zero;
  int _activeHandle = -1; // 0..7 = handle index, -1 = body drag
  _SelectMode _mode = _SelectMode.idle;
  bool _movedDuringDrag = false;

  @override
  void onPointerDown(Offset imagePoint) {
    final currentSelection = controller.selectedAnnotation.value;
    if (currentSelection != null) {
      final handleIdx = _handleHitTest(
        imagePoint,
        currentSelection.boundsInImageSpace,
      );
      if (handleIdx >= 0) {
        _mode = _SelectMode.resize;
        _activeHandle = handleIdx;
        _draggingFrom = currentSelection;
        _initialBounds = currentSelection.boundsInImageSpace;
        _lastPoint = imagePoint;
        _movedDuringDrag = false;
        return;
      }
    }
    final list = controller.committed.value;
    Annotation? hit;
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i].hitTest(imagePoint)) {
        hit = list[i];
        break;
      }
    }
    controller.selectedAnnotation.value = hit;
    _draggingFrom = hit;
    _initialBounds = hit?.boundsInImageSpace ?? Rect.zero;
    _activeHandle = -1;
    _mode = hit == null ? _SelectMode.idle : _SelectMode.move;
    _lastPoint = imagePoint;
    _movedDuringDrag = false;
  }

  @override
  void onPointerMove(Offset imagePoint) {
    if (_mode == _SelectMode.idle) return;
    final selected = _draggingFrom;
    final last = _lastPoint;
    if (selected == null || last == null) return;
    _movedDuringDrag = true;

    if (_mode == _SelectMode.move) {
      final delta = imagePoint - last;
      if (delta == Offset.zero) return;
      _lastPoint = imagePoint;
      final translated = selected.translate(delta);
      _replaceInList(selected, translated);
      _draggingFrom = translated;
      return;
    }

    final newBounds = _newBoundsForHandle(
      _activeHandle,
      _initialBounds,
      imagePoint,
    );
    if (newBounds.width.abs() < 4 || newBounds.height.abs() < 4) return;
    final resized = selected.resize(_initialBounds, newBounds);
    _replaceInList(selected, resized);
    _draggingFrom = resized;
  }

  @override
  void onPointerUp(Offset imagePoint) {
    final moved = _movedDuringDrag;
    _draggingFrom = null;
    _lastPoint = null;
    _activeHandle = -1;
    _initialBounds = Rect.zero;
    _mode = _SelectMode.idle;
    _movedDuringDrag = false;
    if (!moved) return;
    controller.commit(controller.committed.value);
  }

  void _replaceInList(Annotation oldAnnotation, Annotation newAnnotation) {
    final list = [...controller.committed.value];
    final idx = list.indexWhere((a) => a.id == oldAnnotation.id);
    if (idx < 0) return;
    list[idx] = newAnnotation;
    controller.committed.value = List.unmodifiable(list);
    controller.selectedAnnotation.value = newAnnotation;
  }

  /// Returns the index of the handle under [imagePoint] or -1 when none.
  /// Order: 0=TL, 1=TC, 2=TR, 3=CL, 4=CR, 5=BL, 6=BC, 7=BR.
  int _handleHitTest(Offset p, Rect bounds) {
    final handles = <Offset>[
      bounds.topLeft,
      bounds.topCenter,
      bounds.topRight,
      bounds.centerLeft,
      bounds.centerRight,
      bounds.bottomLeft,
      bounds.bottomCenter,
      bounds.bottomRight,
    ];
    for (var i = 0; i < handles.length; i++) {
      if ((handles[i] - p).distance <= _handleHitSlop) return i;
    }
    return -1;
  }

  Rect _newBoundsForHandle(int handle, Rect old, Offset p) {
    switch (handle) {
      case 0:
        return Rect.fromLTRB(p.dx, p.dy, old.right, old.bottom);
      case 1:
        return Rect.fromLTRB(old.left, p.dy, old.right, old.bottom);
      case 2:
        return Rect.fromLTRB(old.left, p.dy, p.dx, old.bottom);
      case 3:
        return Rect.fromLTRB(p.dx, old.top, old.right, old.bottom);
      case 4:
        return Rect.fromLTRB(old.left, old.top, p.dx, old.bottom);
      case 5:
        return Rect.fromLTRB(p.dx, old.top, old.right, p.dy);
      case 6:
        return Rect.fromLTRB(old.left, old.top, old.right, p.dy);
      case 7:
        return Rect.fromLTRB(old.left, old.top, p.dx, p.dy);
      default:
        return old;
    }
  }
}
