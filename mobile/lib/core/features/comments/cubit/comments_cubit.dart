import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';
import 'package:app/core/cache/shared_prefs_service.dart';
import 'package:app/core/enums/request_state.dart';
import 'package:app/core/enums/storage_keys.dart';
import 'package:app/core/features/comments/domain/usecases/comments_usecase.dart';
import 'package:app/core/network/erros/failure_messages.dart';
import 'package:app/core/network/erros/failures.dart';
import 'package:app/core/services/user_service.dart';
import 'package:app/features/study_session/domain/entities/comment_entity.dart';
import 'package:app/features/study_session/domain/enums/comment_reaction.dart';
import 'package:app/features/study_session/domain/enums/comment_report_reason.dart';
import 'package:app/features/study_session/domain/enums/comment_sort_option.dart';

part 'comments_cubit.freezed.dart';
part 'comments_state.dart';

/// Comments cubit — pixel-faithful mirror of the Angular
/// `test-social.service.ts` comment slice (the canonical implementation,
/// not the legacy `question-card.facade.ts`). All deviations would be
/// bugs against the source-of-truth web app.
@injectable
class CommentsCubit extends Cubit<CommentsState> {
  CommentsCubit(this._useCase, this._userService, this._prefs)
      : super(CommentsState(
          // Hydrate the persisted "first-engagement guidelines seen" flag
          // (FR-044, T130). Persisted in SharedPreferences so the modal
          // never auto-shows again after the user dismisses it once.
          hasSeenGuidelines: _prefs.instance
                  .getBool(StorageKeys.communityGuidelinesSeen.name) ??
              false,
        ));

  final CommentsUseCase _useCase;
  final UserService _userService;
  final SharedPrefsService _prefs;

  // ─── Community guidelines (one-time gate, persisted) ──────────────

  /// Marks the guidelines as permanently seen — called when the learner
  /// dismisses the auto-shown sheet via either "Got it" or the close
  /// icon. Writes through to `SharedPreferences` so the gate survives
  /// app restarts. Idempotent: callable any number of times safely.
  void markGuidelinesSeen() {
    if (state.hasSeenGuidelines) return;
    _prefs.instance.setBool(StorageKeys.communityGuidelinesSeen.name, true);
    emit(state.copyWith(hasSeenGuidelines: true));
  }

  // ─── Load ─────────────────────────────────────────────────────────

  /// Mirrors Angular `loadComments(loadMore)` — fresh load resets to page 1
  /// and replaces the list; load-more advances `page + 1` and appends.
  Future<void> loadComments(String questionId, {bool loadMore = false}) async {
    if (state.loadState.isLoading || state.isLoadingMore) return;
    if (loadMore && !state.hasMore) return;

    final nextPage = loadMore ? state.page + 1 : 1;

    emit(state.copyWith(
      loadState: loadMore ? state.loadState : RequestState.loading,
      isLoadingMore: loadMore,
      isTrialLocked: false,
      errorMessage: null,
      comments: loadMore ? state.comments : const [],
      page: loadMore ? state.page : 0,
      total: loadMore ? state.total : 0,
    ));

    final result = await _useCase.getComments(
      questionId,
      page: nextPage,
      sort: state.sort,
    );
    result.fold(
      (failure) => emit(state.copyWith(
        loadState: loadMore ? RequestState.loaded : RequestState.error,
        isLoadingMore: false,
        isTrialLocked: failure is ForbiddenFailure,
        errorMessage:
            failure is ForbiddenFailure ? null : failure.userFacingMessage,
      )),
      (paginated) {
        final merged = loadMore
            ? [...state.comments, ...paginated.comments]
            : paginated.comments;
        emit(state.copyWith(
          loadState: RequestState.loaded,
          isLoadingMore: false,
          comments: merged,
          page: paginated.page,
          total: paginated.total,
        ));
      },
    );
  }

  /// Convenience alias kept for callers that just want the next page.
  Future<void> loadMore(String questionId) =>
      loadComments(questionId, loadMore: true);

  /// Mirrors Angular `changeCommentSort` — clears the list, resets
  /// pagination, swaps the sort, and re-loads from page 1.
  Future<void> changeSort(String questionId, CommentSortOption sort) async {
    if (state.sort == sort) return;
    emit(state.copyWith(
      sort: sort,
      comments: const [],
      page: 0,
      total: 0,
    ));
    await loadComments(questionId);
  }

  // ─── Composer ────────────────────────────────────────────────────

  void updateComposer(String text) => emit(state.copyWith(composerText: text));

  void startReply(String commentId) =>
      emit(state.copyWith(replyToCommentId: commentId, composerText: ''));

  void cancelReply() =>
      emit(state.copyWith(replyToCommentId: null, composerText: ''));

  // ─── Post ────────────────────────────────────────────────────────

  /// Mirrors Angular `postComment` — optimistic temp insert, replace on
  /// success, rollback on error.
  ///
  /// Top-level comments unshift to the front; replies insert directly
  /// after their parent in the flattened list (so the visual ordering
  /// matches Angular's nested rendering).
  Future<void> postComment(String questionId) async {
    final text = state.composerText.trim();
    if (text.isEmpty || text.length > CommentEntity.maxCommentLength) return;

    final parentId = state.replyToCommentId;
    final tempId = 'temp_${DateTime.now().millisecondsSinceEpoch}';
    final optimistic = _buildOptimisticComment(
      tempId: tempId,
      questionId: questionId,
      text: text,
      parentId: parentId,
    );

    // Clear the textarea immediately — the optimistic temp shows the
    // user the comment landed. `replyToCommentId` is held until the
    // POST resolves so the bottom reply bar stays visible (with its
    // own spinner on the send button) instead of unmounting and
    // remounting the top composer mid-flight, which would briefly
    // surface a spinner on the top "Add Comment" CTA.
    emit(state.copyWith(
      isPosting: true,
      isTrialLocked: false,
      errorMessage: null,
      comments: _insertOptimistic(state.comments, optimistic, parentId),
      composerText: '',
    ));

    final result = await _useCase.postComment(
      questionId,
      text,
      parentId: parentId,
    );

    result.fold(
      (failure) => emit(state.copyWith(
        isPosting: false,
        isTrialLocked: failure is ForbiddenFailure,
        errorMessage:
            failure is ForbiddenFailure ? null : failure.userFacingMessage,
        comments: state.comments.where((c) => c.commentId != tempId).toList(),
        // Keep `replyToCommentId` set on failure so the user can
        // retry without re-tapping the comment they intended to reply
        // to. Their text is gone (already optimistically committed),
        // but the reply target is preserved.
      )),
      (saved) => emit(state.copyWith(
        isPosting: false,
        replyToCommentId: null,
        comments: state.comments
            .map((c) => c.commentId == tempId
                ? saved.copyWith(
                    isPending: false,
                  )
                : c)
            .toList(),
      )),
    );
  }

  // ─── Reactions ───────────────────────────────────────────────────

  /// Optimistic toggle for like/dislike — instant UI, server-reconciled.
  ///
  /// **Trade-off note.** The backend doesn't return the viewer's
  /// `myReaction` in the listing select (`comment.service.ts:262-321`)
  /// or the react response (`comment.service.ts:440-447`). On a fresh
  /// load, the in-memory `myReactions` map is empty even when the user
  /// has a stored reaction from a prior session, so the cubit can't
  /// distinguish "no prior reaction" from "prior reaction unknown".
  ///
  /// We optimistically assume "no prior reaction" because that's the
  /// statistically common case — most users tap once and move on. The
  /// happy path is instant (icon flips, count updates immediately,
  /// server confirms). On the rare second-visit-and-untap case, the
  /// count briefly shows the wrong value (`1 → 2 → 0`) before the
  /// server response snaps it to the truth.
  ///
  /// Once the user has tapped at least once in this session, the local
  /// map is populated and all subsequent taps are flicker-free —
  /// because the reconcile step infers the resulting reaction from the
  /// count delta and updates the map, so we always know the state for
  /// the rest of the session.
  ///
  /// **Permanent fix:** include `myReaction` in the listing select on
  /// the backend. Then the cubit can pre-populate the map at load time
  /// and never has to guess.
  ///
  /// Optimistic deltas (driven by the local map):
  ///
  /// | prior   | tap     | likes | dislikes |
  /// |---------|---------|-------|----------|
  /// | none    | like    | +1    |  0       |
  /// | none    | dislike |  0    | +1       |
  /// | like    | like    | -1    |  0       |  (un-like)
  /// | like    | dislike | -1    | +1       |  (switch)
  /// | dislike | like    | +1    | -1       |  (switch)
  /// | dislike | dislike |  0    | -1       |  (un-dislike)
  Future<void> toggleLike(String commentId) =>
      _react(commentId, CommentReaction.like);

  Future<void> toggleDislike(String commentId) =>
      _react(commentId, CommentReaction.dislike);

  Future<void> _react(String commentId, CommentReaction reaction) async {
    final index = _indexOf(commentId);
    if (index == -1) return;

    final original = state.comments[index];
    final originalReaction = state.reactionFor(commentId);
    final isToggleOff = originalReaction == reaction;

    final int likesDelta;
    final int dislikesDelta;
    if (reaction == CommentReaction.like) {
      likesDelta = isToggleOff ? -1 : 1;
      dislikesDelta = originalReaction == CommentReaction.dislike ? -1 : 0;
    } else {
      dislikesDelta = isToggleOff ? -1 : 1;
      likesDelta = originalReaction == CommentReaction.like ? -1 : 0;
    }

    final updatedReactions =
        Map<String, CommentReaction>.from(state.myReactions);
    if (isToggleOff) {
      updatedReactions.remove(commentId);
    } else {
      updatedReactions[commentId] = reaction;
    }

    emit(state.copyWith(
      comments: _replaceAt(
        state.comments,
        index,
        original.copyWith(
          likesCount: original.likesCount + likesDelta,
          dislikesCount: original.dislikesCount + dislikesDelta,
        ),
      ),
      myReactions: updatedReactions,
    ));

    final result = await _useCase.reactComment(commentId, reaction);
    result.fold(
      (failure) {
        // Roll back optimistic state on error.
        final rollbackReactions =
            Map<String, CommentReaction>.from(state.myReactions);
        if (originalReaction == CommentReaction.none) {
          rollbackReactions.remove(commentId);
        } else {
          rollbackReactions[commentId] = originalReaction;
        }
        final currentIndex = _indexOf(commentId);
        if (currentIndex == -1) {
          emit(state.copyWith(
            myReactions: rollbackReactions,
            errorMessage: failure.userFacingMessage,
          ));
          return;
        }
        emit(state.copyWith(
          comments: _replaceAt(state.comments, currentIndex, original),
          myReactions: rollbackReactions,
          errorMessage: failure.userFacingMessage,
        ));
      },
      (counts) {
        // Server-authoritative counts. Also infer the resulting
        // reaction from the count delta vs pre-tap, so the local map
        // stays accurate even if our optimistic guess was wrong.
        final currentIndex = _indexOf(commentId);
        if (currentIndex == -1) return;

        final serverLikesDelta = counts.likesCount - original.likesCount;
        final serverDislikesDelta =
            counts.dislikesCount - original.dislikesCount;

        final reconciledReactions =
            Map<String, CommentReaction>.from(state.myReactions);
        if (reaction == CommentReaction.like) {
          if (serverLikesDelta > 0) {
            reconciledReactions[commentId] = CommentReaction.like;
          } else if (serverLikesDelta < 0) {
            reconciledReactions.remove(commentId);
          }
        } else {
          if (serverDislikesDelta > 0) {
            reconciledReactions[commentId] = CommentReaction.dislike;
          } else if (serverDislikesDelta < 0) {
            reconciledReactions.remove(commentId);
          }
        }

        final current = state.comments[currentIndex];
        emit(state.copyWith(
          comments: _replaceAt(
            state.comments,
            currentIndex,
            current.copyWith(
              likesCount: counts.likesCount,
              dislikesCount: counts.dislikesCount,
            ),
          ),
          myReactions: reconciledReactions,
        ));
      },
    );
  }

  // ─── Report ──────────────────────────────────────────────────────

  /// Mirrors Angular `reportComment` — fire-and-forget POST, success
  /// surfaces as a single confirmation handled by the UI.
  Future<bool> reportComment(
    String commentId,
    CommentReportReason reason, {
    String? details,
  }) async {
    final result =
        await _useCase.reportComment(commentId, reason, details: details);
    return result.fold(
      (failure) {
        emit(state.copyWith(errorMessage: failure.userFacingMessage));
        return false;
      },
      (_) => true,
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  int _indexOf(String commentId) =>
      state.comments.indexWhere((c) => c.commentId == commentId);

  List<CommentEntity> _replaceAt(
    List<CommentEntity> list,
    int index,
    CommentEntity entity,
  ) {
    final next = List<CommentEntity>.from(list);
    next[index] = entity;
    return next;
  }

  /// Top-level → unshift to the front. Reply → insert directly after the
  /// parent (and after any existing siblings). Mirrors Angular's
  /// `currentComments.unshift(optimisticComment)` for top-level and the
  /// `parent.replies = [...parent.replies, optimisticComment]` for replies.
  List<CommentEntity> _insertOptimistic(
    List<CommentEntity> list,
    CommentEntity optimistic,
    String? parentId,
  ) {
    if (parentId == null) {
      return [optimistic, ...list];
    }
    final parentIndex = list.indexWhere((c) => c.commentId == parentId);
    if (parentIndex == -1) return [...list, optimistic];
    var insertAt = parentIndex + 1;
    while (insertAt < list.length && list[insertAt].parentId == parentId) {
      insertAt++;
    }
    final next = List<CommentEntity>.from(list)..insert(insertAt, optimistic);
    return next;
  }

  CommentEntity _buildOptimisticComment({
    required String tempId,
    required String questionId,
    required String text,
    required String? parentId,
  }) {
    final user = _userService.user;
    return CommentEntity(
      commentId: tempId,
      questionId: questionId,
      userId: user?.id ?? '',
      parentId: parentId,
      commentText: text,
      createdAt: DateTime.now(),
      author: CommentAuthorEntity(
        username: user?.username,
        // Angular falls back to "You" when the optimistic entry has no
        // server-provided fullName.
        fullName: user?.profile?.fullName ?? 'You',
        imageUrl: user?.profile?.imageUrl,
      ),
      likesCount: 0,
      dislikesCount: 0,
      repliesCount: 0,
      depth: parentId == null ? 0 : 1,
      isVerified: false,
      isBanned: false,
      myReaction: CommentReaction.none,
      isPending: true,
    );
  }
}
