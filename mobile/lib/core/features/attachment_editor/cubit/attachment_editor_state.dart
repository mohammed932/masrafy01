part of 'attachment_editor_cubit.dart';

@freezed
class AttachmentEditorState with _$AttachmentEditorState {
  const factory AttachmentEditorState({
    @Default(AttachmentEditorTool.none) AttachmentEditorTool currentTool,

    /// Image rotation in degrees (0 / 90 / 180 / 270). Mirrors Angular
    /// `HistoryState.imageRotation`.
    @Default(0) int imageRotation,

    /// Cubit-side mirrors of `PainterController.canUndo / canRedo` so the
    /// toolbar's undo/redo buttons can rebuild via `BlocBuilder` without
    /// reading the controller directly. The screen wires a controller
    /// listener that calls `setUndoRedoAvailability(...)` after every
    /// drawable add / undo / redo.
    @Default(false) bool canUndo,
    @Default(false) bool canRedo,
  }) = _AttachmentEditorState;
}
