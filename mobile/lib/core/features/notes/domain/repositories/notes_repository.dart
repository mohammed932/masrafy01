import 'package:dartz/dartz.dart';
import 'package:app/core/architecture/base_repository.dart';
import 'package:app/core/network/erros/failures.dart';
import 'package:app/features/study_session/data/datasources/study_session_datasource.dart';
import 'package:app/features/study_session/domain/entities/user_note_entity.dart';

abstract class NotesRepository extends BaseRepository<StudySessionDataSource> {
  NotesRepository(super.remoteDataSource);

  Future<Either<Failure, UserNoteEntity?>> getNote(String questionId);

  Future<Either<Failure, UserNoteEntity>> createNote(
    String questionId,
    String noteText,
  );

  Future<Either<Failure, UserNoteEntity>> updateNote(
    String noteId,
    String noteText,
  );

  Future<Either<Failure, Unit>> deleteNote(String noteId);
}
