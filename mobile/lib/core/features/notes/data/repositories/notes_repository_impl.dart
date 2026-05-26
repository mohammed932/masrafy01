import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';
import 'package:app/core/features/notes/domain/repositories/notes_repository.dart';
import 'package:app/core/network/erros/failures.dart';
import 'package:app/core/utils/api_handler.dart';
import 'package:app/features/study_session/data/models/request/save_note_request/save_note_request.dart';
import 'package:app/features/study_session/data/models/request/update_note_request/update_note_request.dart';
import 'package:app/features/study_session/data/models/response/user_note_response/user_note_response.model.dart';
import 'package:app/features/study_session/domain/entities/user_note_entity.dart';

@Injectable(as: NotesRepository)
class NotesRepositoryImpl extends NotesRepository {
  NotesRepositoryImpl(super.remoteDataSource);

  @override
  Future<Either<Failure, UserNoteEntity?>> getNote(String questionId) =>
      ApiHandler.callApi(() async {
        final model = await remoteDataSource.getNote(questionId);
        return model?.toEntity();
      });

  @override
  Future<Either<Failure, UserNoteEntity>> createNote(
    String questionId,
    String noteText,
  ) =>
      ApiHandler.callApi(() async {
        final model = await remoteDataSource.createNote(
          SaveNoteRequest(questionId: questionId, noteText: noteText),
        );
        return model.toEntity();
      });

  @override
  Future<Either<Failure, UserNoteEntity>> updateNote(
    String noteId,
    String noteText,
  ) =>
      ApiHandler.callApi(() async {
        final model = await remoteDataSource.updateNote(
          noteId,
          UpdateNoteRequest(noteText: noteText),
        );
        return model.toEntity();
      });

  @override
  Future<Either<Failure, Unit>> deleteNote(String noteId) =>
      ApiHandler.callApi(() async {
        await remoteDataSource.deleteNote(noteId);
        return unit;
      });
}
