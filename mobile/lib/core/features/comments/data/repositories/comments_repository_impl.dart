import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';
import 'package:app/core/features/comments/domain/repositories/comments_repository.dart';
import 'package:app/core/network/erros/failures.dart';
import 'package:app/core/utils/api_handler.dart';
import 'package:app/features/study_session/data/models/request/post_comment_request/post_comment_request.dart';
import 'package:app/features/study_session/data/models/request/react_comment_request/react_comment_request.dart';
import 'package:app/features/study_session/data/models/request/report_comment_request/report_comment_request.dart';
import 'package:app/features/study_session/data/models/response/comment_reaction_response/comment_reaction_response.model.dart';
import 'package:app/features/study_session/data/models/response/paginated_comments_response/paginated_comments_response.model.dart';
import 'package:app/features/study_session/domain/entities/comment_entity.dart';
import 'package:app/features/study_session/domain/entities/comment_reaction_result_entity.dart';
import 'package:app/features/study_session/domain/enums/comment_reaction.dart';
import 'package:app/features/study_session/domain/enums/comment_report_reason.dart';
import 'package:app/features/study_session/domain/enums/comment_sort_option.dart';

@Injectable(as: CommentsRepository)
class CommentsRepositoryImpl extends CommentsRepository {
  CommentsRepositoryImpl(super.remoteDataSource);

  @override
  Future<Either<Failure, PaginatedCommentsEntity>> getComments(
    String questionId, {
    required int page,
    required CommentSortOption sort,
  }) =>
      ApiHandler.callApi(() async {
        final model = await remoteDataSource.getComments(
          questionId,
          page: page,
          limit: 10,
          sortBy: sort.toRemote(),
        );
        return model.toEntity();
      });

  @override
  Future<Either<Failure, CommentEntity>> postComment(
    String questionId,
    String commentText, {
    String? parentId,
  }) =>
      ApiHandler.callApi(() async {
        final model = await remoteDataSource.postComment(
          PostCommentRequest(
            questionId: questionId,
            commentText: commentText,
            parentId: parentId,
          ),
        );
        return model.toEntity(parentId: parentId);
      });

  @override
  Future<Either<Failure, CommentReactionResultEntity>> reactComment(
    String commentId,
    CommentReaction reaction,
  ) =>
      ApiHandler.callApi(() async {
        final model = await remoteDataSource.reactComment(
          commentId,
          ReactCommentRequest(reactionType: reaction.toRemote()!),
        );
        return model.toEntity();
      });

  @override
  Future<Either<Failure, Unit>> reportComment(
    String commentId,
    CommentReportReason reason, {
    String? details,
  }) =>
      ApiHandler.callApi(() async {
        await remoteDataSource.reportComment(
          commentId,
          ReportCommentRequest(reason: reason.toRemote(), details: details),
        );
        return unit;
      });
}
