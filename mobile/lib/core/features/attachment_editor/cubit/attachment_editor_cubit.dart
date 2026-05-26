import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

part 'attachment_editor_cubit.freezed.dart';
part 'attachment_editor_state.dart';

/// Mirrors Angular `AttachmentEditorComponent`'s tool enum. Drives toolbar
/// selection + which Drawable the canvas writes on tap/drag.
enum AttachmentEditorTool {
  none,
  select,
  pan,
  dot,
  line,
  arrow,
  perpendicular,
  measure,
  angle,
  ellipse,
  crosshair,
  text,
}

/// Local-only annotation editor cubit. No backend persist (matches
/// Angular — annotations are session-scoped). Owns:
/// • Active tool selection
/// • Image rotation (90° steps)
/// • Undo/redo cursors (the actual drawable list lives in
///   `PainterController.value.drawables`; cubit only mirrors `canUndo` /
///   `canRedo` so the toolbar can rebuild without reading the controller).
@injectable
class AttachmentEditorCubit extends Cubit<AttachmentEditorState> {
  AttachmentEditorCubit() : super(const AttachmentEditorState());

  void selectTool(AttachmentEditorTool tool) =>
      emit(state.copyWith(currentTool: tool));

  void rotate() =>
      emit(state.copyWith(imageRotation: (state.imageRotation + 90) % 360));

  void resetRotation() => emit(state.copyWith(imageRotation: 0));

  void setUndoRedoAvailability({required bool canUndo, required bool canRedo}) {
    if (canUndo == state.canUndo && canRedo == state.canRedo) return;
    emit(state.copyWith(canUndo: canUndo, canRedo: canRedo));
  }
}
