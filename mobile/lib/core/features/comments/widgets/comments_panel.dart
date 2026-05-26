part of 'comments_widgets.imports.dart';

/// Mirrors the Angular `comment-viewer.component` for the body
/// (composer at top, then header, then inline one-level-deep reply tree)
/// with one Flutter-only enhancement: a **first-engagement guidelines
/// auto-show** gated by a persisted `SharedPreferences` flag (FR-044 /
/// T130). After the learner dismisses the sheet once via "Got it" or
/// the close icon, it never auto-opens again. The "comment guidelines"
/// link in the composer caption remains a manual re-entry at any time.
class CommentsPanel extends StatefulWidget {
  const CommentsPanel({super.key, required this.questionId, this.currentUserId});

  final String questionId;
  final String? currentUserId;

  @override
  State<CommentsPanel> createState() => _CommentsPanelState();
}

class _CommentsPanelState extends State<CommentsPanel> {
  final _composerController = TextEditingController();

  @override
  void initState() {
    super.initState();
    final cubit = context.read<CommentsCubit>();
    cubit.loadComments(widget.questionId);

    // FR-044 / T130 — first-engagement guidelines auto-show. Persisted
    // gate: hydrated from prefs in the cubit's constructor. Marking
    // seen flips the persisted flag, so this runs at most once per
    // device install.
    if (!cubit.state.hasSeenGuidelines) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        cubit.markGuidelinesSeen();
        CommunityGuidelinesSheet.show(context);
      });
    }
  }

  @override
  void dispose() {
    _composerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);

    return BlocListener<CommentsCubit, CommentsState>(
      listenWhen: (p, c) =>
          (c.isTrialLocked && !p.isTrialLocked) ||
          (p.isPosting && !c.isPosting && !c.isTrialLocked && c.errorMessage == null),
      listener: (ctx, state) {
        if (state.isTrialLocked) {
          _showTrialLockedDialog(ctx, colors, texts);
        } else {
          const PilotSuccessToast(message: 'Comment posted successfully!')
              .show(ctx);
        }
      },
      child: Stack(
        children: [
          CustomScrollView(
            slivers: [
              // Top composer is hidden during a reply — the FB-style
              // bottom bar (overlaid below) takes over the input task.
              SliverToBoxAdapter(
                child: BlocBuilder<CommentsCubit, CommentsState>(
                  buildWhen: (p, c) =>
                      c.replyToCommentId != p.replyToCommentId,
                  builder: (context, state) {
                    if (state.replyToCommentId != null) {
                      return const SizedBox.shrink();
                    }
                    return _Composer(
                      controller: _composerController,
                      questionId: widget.questionId,
                      colors: colors,
                      texts: texts,
                    );
                  },
                ),
              ),
              SliverToBoxAdapter(
                child: BlocBuilder<CommentsCubit, CommentsState>(
                  buildWhen: (p, c) =>
                      c.replyToCommentId != p.replyToCommentId,
                  builder: (context, state) {
                    if (state.replyToCommentId != null) {
                      return const SizedBox.shrink();
                    }
                    return Divider(height: 1, color: colors.border.main);
                  },
                ),
              ),
          SliverPersistentHeader(
            pinned: true,
            delegate: PilotPersistentHeaderDelegate(
              height: _kCommentsHeaderHeight.h,
              child: ColoredBox(
                color: colors.bg.container,
                child: _Header(
                  colors: colors,
                  texts: texts,
                  questionId: widget.questionId,
                ),
              ),
            ),
          ),
          BlocBuilder<CommentsCubit, CommentsState>(
            buildWhen: (p, c) =>
                c.comments != p.comments ||
                c.loadState != p.loadState ||
                c.isLoadingMore != p.isLoadingMore,
            builder: (context, state) {
              if (state.isInitialLoading) {
                return const SliverFillRemaining(
                  hasScrollBody: false,
                  child: CommentsSkeleton(),
                );
              }
              if (state.loadState.isError && state.comments.isEmpty) {
                return SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Text(
                      state.errorMessage ?? 'Failed to load comments.',
                      style: texts.body.copyWith(color: colors.text.secondary),
                      textAlign: TextAlign.center,
                    ),
                  ),
                );
              }
              if (state.comments.isEmpty) {
                return SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Text(
                      'No comments yet. Be the first!',
                      style: texts.body.copyWith(color: colors.text.secondary),
                    ),
                  ),
                );
              }

              final comments = state.comments;
              return SliverPadding(
                padding:
                    EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
                sliver: SliverList.builder(
                  itemCount: comments.length + (state.hasMore ? 1 : 0),
                  itemBuilder: (ctx, i) {
                    if (i == comments.length) {
                      return _LoadMoreButton(
                        isLoading: state.isLoadingMore,
                        colors: colors,
                        texts: texts,
                        onTap: () => context
                            .read<CommentsCubit>()
                            .loadMore(widget.questionId),
                      );
                    }
                    final comment = comments[i];
                    return CommentTile(
                      comment: comment,
                      myReaction: state.reactionFor(comment.commentId),
                      currentUserId: widget.currentUserId,
                      onReply: () => context
                          .read<CommentsCubit>()
                          .startReply(comment.commentId),
                    );
                  },
                ),
              );
            },
          ),
        ],
          ),
          // FB-style sticky reply bar — appears above the keyboard while
          // a reply target is set. Tapping "Reply" on a comment mounts
          // this bar; the bar auto-focuses its text field so the OS
          // keyboard slides up immediately.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: BlocBuilder<CommentsCubit, CommentsState>(
              buildWhen: (p, c) =>
                  c.replyToCommentId != p.replyToCommentId,
              builder: (context, state) {
                if (state.replyToCommentId == null) {
                  return const SizedBox.shrink();
                }
                return _ReplyBottomBar(
                  questionId: widget.questionId,
                  colors: colors,
                  texts: texts,
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _showTrialLockedDialog(
      BuildContext ctx, PilotColorTheme colors, PilotTextTheme texts) {
    PilotInfoDialog.show(
      ctx,
      title: 'Upgrade Required',
      message:
          'Comments are available on the Pro plan. Upgrade to join the discussion.',
    );
  }
}

