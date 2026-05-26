import 'package:dartz/dartz.dart';
import 'package:app/core/architecture/base_repository.dart';
import 'package:app/core/network/erros/failures.dart';
import 'package:app/features/study_session/data/datasources/study_session_datasource.dart';
import 'package:app/features/study_session/domain/entities/comment_entity.dart';
import 'package:app/features/study_session/domain/entities/comment_reaction_result_entity.dart';
import 'package:app/features/study_session/domain/enums/comment_reaction.dart';
import 'package:app/features/study_session/domain/enums/comment_report_reason.dart';
import 'package:app/features/study_session/domain/enums/comment_sort_option.dart';

abstract class CommentsRepository
    extends BaseRepository<StudySessionDataSource> {
  CommentsRepository(super.remoteDataSource);

  Future<Either<Failure, PaginatedCommentsEntity>> getComments(
    String questionId, {
    required int page,
    required CommentSortOption sort,
  });

  Future<Either<Failure, CommentEntity>> postComment(
    String questionId,
    String commentText, {
    String? parentId,
  });

  Future<Either<Failure, CommentReactionResultEntity>> reactComment(
    String commentId,
    CommentReaction reaction,
  );

  Future<Either<Failure, Unit>> reportComment(
    String commentId,
    CommentReportReason reason, {
    String? details,
  });
}
