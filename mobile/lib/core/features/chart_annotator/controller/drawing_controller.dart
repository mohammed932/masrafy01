import 'dart:ui';

import 'package:flutter/foundation.dart';

import '../model/annotation.dart';
import 'tool_type.dart';
import 'undo_stack.dart';

/// Owns every piece of reactive annotator state.
///
/// Each layer / toolbar widget subscribes only to the [ValueNotifier] fields
/// it cares about via `ValueListenableBuilder`, so a draft-frame change
/// repaints only the active-draft layer — the image and committed layers
/// stay isolated by their `RepaintBoundary`.
class DrawingController {
  DrawingController({
    List<Annotation> initialAnnotations = const [],
    ToolType initialTool = ToolType.select,
  }) : committed = ValueNotifier(List.unmodifiable(initialAnnotations)),
       currentTool = ValueNotifier(initialTool),
       _undoStack = UndoStack(),
       canUndo = ValueNotifier(false),
       canRedo = ValueNotifier(false) {
    if (initialAnnotations.isNotEmpty) {
      _undoStack.push(initialAnnotations);
    }
    activeDraft.addListener(_refreshHistoryFlags);
  }

  /// Persistent annotations — repainted by `CommittedLayer`.
  final ValueNotifier<List<Annotation>> committed;

  /// In-flight annotation being drawn — repainted by `ActiveDraftLayer`.
  /// Null when no tool is mid-stroke.
  final ValueNotifier<Annotation?> activeDraft = ValueNotifier(null);

  /// Crosshair position in image space — drives `CrosshairLayer`. Null when
  /// the crosshair tool is inactive or pointer left the canvas.
  final ValueNotifier<Offset?> crosshairPosition = ValueNotifier(null);

  /// Currently-selected annotation (Select tool). Null when none.
  final ValueNotifier<Annotation?> selectedAnnotation = ValueNotifier(null);

  /// Active tool. Mode tools stay sticky; action tools are dispatched by the
  /// toolbar without writing here.
  final ValueNotifier<ToolType> currentTool;

  final ValueNotifier<bool> canUndo;
  final ValueNotifier<bool> canRedo;

  /// One-shot tick the `ToolGestureRouter` listens on to invoke
  /// `activeHandler.onCancel()` — used when [undo] discards an in-flight
  /// draft (multi-tap angle / perpendicular) so the handler also resets its
  /// internal tap-count state.
  final ValueNotifier<int> cancelTick = ValueNotifier(0);

  final UndoStack _undoStack;

  /// Replaces the committed list and snapshots it onto the undo stack.
  /// Always treat the list as immutable — pass a fresh `List<Annotation>`.
  void commit(List<Annotation> next) {
    committed.value = List.unmodifiable(next);
    _undoStack.push(committed.value);
    _refreshHistoryFlags();
  }

  /// Removes the currently-selected annotation from the committed list and
  /// pushes the result onto the undo stack. No-op when nothing is selected.
  void deleteSelected() {
    final selected = selectedAnnotation.value;
    if (selected == null) return;
    final next = committed.value
        .where((a) => a.id != selected.id)
        .toList(growable: false);
    selectedAnnotation.value = null;
    commit(next);
  }

  /// Drops the current selection without touching the committed list.
  void clearSelection() {
    selectedAnnotation.value = null;
  }

  /// Wipes every committed annotation and the active draft. Pushed as a
  /// single undo entry so the user can revert the clear.
  void clearAll() {
    activeDraft.value = null;
    selectedAnnotation.value = null;
    if (committed.value.isEmpty) return;
    commit(const []);
  }

  /// Steps history back one snapshot. When an active draft is in flight
  /// (e.g. the user has tapped vertex + ray-A for the angle tool but not yet
  /// committed), this first discards the draft + resets the active handler's
  /// internal state — only on a subsequent `undo` does it walk the committed
  /// history. Mirrors common drawing-app UX: "undo cancels what's visible."
  void undo() {
    if (activeDraft.value != null) {
      activeDraft.value = null;
      cancelTick.value++;
      return;
    }
    final snapshot = _undoStack.undo();
    if (snapshot == null) return;
    committed.value = snapshot;
    _refreshHistoryFlags();
  }

  void redo() {
    final snapshot = _undoStack.redo();
    if (snapshot == null) return;
    committed.value = snapshot;
    _refreshHistoryFlags();
  }

  void _refreshHistoryFlags() {
    canUndo.value = activeDraft.value != null || _undoStack.canUndo;
    canRedo.value = _undoStack.canRedo;
  }

  void dispose() {
    activeDraft.removeListener(_refreshHistoryFlags);
    committed.dispose();
    activeDraft.dispose();
    crosshairPosition.dispose();
    selectedAnnotation.dispose();
    currentTool.dispose();
    canUndo.dispose();
    canRedo.dispose();
    cancelTick.dispose();
  }
}
