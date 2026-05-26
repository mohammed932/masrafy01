import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';
import 'package:app/core/architecture/base_usecase.dart';
import 'package:app/core/features/comments/domain/repositories/comments_repository.dart';
import 'package:app/core/network/erros/failures.dart';
import 'package:app/features/study_session/domain/entities/comment_entity.dart';
import 'package:app/features/study_session/domain/entities/comment_reaction_result_entity.dart';
import 'package:app/features/study_session/domain/enums/comment_reaction.dart';
import 'package:app/features/study_session/domain/enums/comment_report_reason.dart';
import 'package:app/features/study_session/domain/enums/comment_sort_option.dart';

@injectable
class CommentsUseCase extends BaseUseCase<CommentsRepository> {
  CommentsUseCase(super.repository);

  Future<Either<Failure, PaginatedCommentsEntity>> getComments(
    String questionId, {
    required int page,
    required CommentSortOption sort,
  }) =>
      repository.getComments(questionId, page: page, sort: sort);

  Future<Either<Failure, CommentEntity>> postComment(
    String questionId,
    String commentText, {
    String? parentId,
  }) =>
      repository.postComment(questionId, commentText, parentId: parentId);

  Future<Either<Failure, CommentReactionResultEntity>> reactComment(
    String commentId,
    CommentReaction reaction,
  ) =>
      repository.reactComment(commentId, reaction);

  Future<Either<Failure, Unit>> reportComment(
    String commentId,
    CommentReportReason reason, {
    String? details,
  }) =>
      repository.reportComment(commentId, reason, details: details);
}
