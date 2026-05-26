part of 'comments_cubit.dart';

/// Mirrors the Angular `test-session.store` slice that backs the comment
/// viewer. Holds: paginated comments, sort, composer text, reply target,
/// per-screen reaction map (Angular: `comment-viewer.component.ts:111`),
/// load/post flags, and trial-locked flag.
@freezed
class CommentsState with _$CommentsState {
  const factory CommentsState({
    @Default([]) List<CommentEntity> comments,
    @Default(0) int total,
    @Default(0) int page,
    @Default(CommentSortOption.likes) CommentSortOption sort,
    @Default(RequestState.initial) RequestState loadState,
    @Default(false) bool isLoadingMore,
    @Default(false) bool isPosting,
    @Default('') String composerText,
    String? replyToCommentId,
    @Default({}) Map<String, CommentReaction> myReactions,
    @Default(false) bool isTrialLocked,
    @Default(false) bool hasSeenGuidelines,
    String? errorMessage,
  }) = _CommentsState;
  // ignore: unused_element
  const CommentsState._();

  bool get canPost =>
      composerText.trim().isNotEmpty &&
      composerText.length <= CommentEntity.maxCommentLength;

  bool get isInitialLoading => loadState.isLoading && comments.isEmpty;

  /// Cumulative `hasMore` (Angular: `newComments.length < total`).
  bool get hasMore => comments.length < total;

  CommentEntity? get replyTarget => replyToCommentId == null
      ? null
      : comments.where((c) => c.commentId == replyToCommentId).firstOrNull;

  /// Looks up the viewer's reaction for a comment from the in-memory map.
  /// Returns [CommentReaction.none] when nothing is recorded — matches
  /// Angular's "neutral until tapped" initial state.
  CommentReaction reactionFor(String commentId) =>
      myReactions[commentId] ?? CommentReaction.none;
}
