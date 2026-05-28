import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';
import 'package:app/core/enums/request_state.dart';
import 'package:app/core/features/notes/domain/usecases/notes_usecase.dart';
import 'package:app/core/network/erros/failure_messages.dart';
import 'package:app/core/network/erros/failures.dart';
import 'package:app/features/study_session/domain/entities/user_note_entity.dart';

part 'notes_cubit.freezed.dart';
part 'notes_state.dart';

@injectable
class NotesCubit extends Cubit<NotesState> {
  final NotesUseCase _useCase;

  NotesCubit(this._useCase) : super(const NotesState());

  Future<void> loadNote(String questionId) async {
    emit(state.copyWith(noteState: RequestState.loading, errorMessage: null));
    final result = await _useCase.getNote(questionId);
    result.fold(
      (failure) => emit(state.copyWith(
        noteState: RequestState.error,
        errorMessage: failure.userFacingMessage,
      )),
      (note) => emit(state.copyWith(
        noteState: RequestState.loaded,
        note: note,
        composerText: note?.noteText ?? '',
      )),
    );
  }

  void updateComposer(String text) =>
      emit(state.copyWith(composerText: text));

  Future<void> saveNote(String questionId) async {
    if (!state.canSave) return;
    emit(state.copyWith(isSaving: true, errorMessage: null));

    final existing = state.note;
    final result = existing == null
        ? await _useCase.createNote(questionId, state.composerText)
        : await _useCase.updateNote(
            existing.questionNoteId, state.composerText);

    result.fold(
      (failure) => emit(state.copyWith(
        isSaving: false,
        isTrialLocked: failure is ForbiddenFailure,
        errorMessage:
            failure is ForbiddenFailure ? null : failure.userFacingMessage,
      )),
      (savedNote) => emit(state.copyWith(
        isSaving: false,
        note: savedNote,
        composerText: savedNote.noteText,
      )),
    );
  }

  Future<void> deleteNote() async {
    final noteId = state.note?.questionNoteId;
    if (noteId == null) return;
    emit(state.copyWith(isDeleting: true, errorMessage: null));
    final result = await _useCase.deleteNote(noteId);
    result.fold(
      (failure) => emit(state.copyWith(
        isDeleting: false,
        errorMessage: failure.userFacingMessage,
      )),
      (_) => emit(state.copyWith(
        isDeleting: false,
        note: null,
        composerText: '',
        noteState: RequestState.loaded,
      )),
    );
  }
}
