import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';
import 'package:app/core/architecture/base_usecase.dart';
import 'package:app/core/features/notes/domain/repositories/notes_repository.dart';
import 'package:app/core/network/erros/failures.dart';
import 'package:app/features/study_session/domain/entities/user_note_entity.dart';

@injectable
class NotesUseCase extends BaseUseCase<NotesRepository> {
  NotesUseCase(super.repository);

  Future<Either<Failure, UserNoteEntity?>> getNote(String questionId) =>
      repository.getNote(questionId);

  Future<Either<Failure, UserNoteEntity>> createNote(
    String questionId,
    String noteText,
  ) =>
      repository.createNote(questionId, noteText);

  Future<Either<Failure, UserNoteEntity>> updateNote(
    String noteId,
    String noteText,
  ) =>
      repository.updateNote(noteId, noteText);

  Future<Either<Failure, Unit>> deleteNote(String noteId) =>
      repository.deleteNote(noteId);
}
