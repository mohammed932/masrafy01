part of 'notes_cubit.dart';

@freezed
class NotesState with _$NotesState {
  const factory NotesState({
    @Default(RequestState.initial) RequestState noteState,
    UserNoteEntity? note,
    @Default('') String composerText,
    @Default(false) bool isSaving,
    @Default(false) bool isDeleting,
    @Default(false) bool isTrialLocked,
    String? errorMessage,
  }) = _NotesState;
  // ignore: unused_element
  const NotesState._();

  bool get canSave => UserNoteEntity.isValidText(composerText);
  bool get hasNote => note != null;
  bool get isDirty => composerText != (note?.noteText ?? '');
  bool get showCharCounter => composerText.isNotEmpty;
  int get charsRemaining =>
      UserNoteEntity.maxNoteLength - composerText.length;
}
