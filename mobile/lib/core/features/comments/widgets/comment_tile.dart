part of 'comments_widgets.imports.dart';

// Mirrors Angular `comment-viewer.component.html:76` (`date:'mediumDate'`).
// One absolute format only — Angular has no relative-time fallback.
String _formatCommentDate(DateTime createdAt) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${createdAt.day} ${months[createdAt.month - 1]}, ${createdAt.year}';
}

/// Single comment row — pixel-perfect mirror of Figma frame 3173:50890.
///
/// `myReaction` is supplied by the parent (the cubit's per-screen reaction
/// map). The backend never returns the viewer's own reaction, so the
/// entity itself always reports [CommentReaction.none] — Angular keeps
/// the same client-side-only contract (`comment-viewer.component.ts:111`).
class CommentTile extends StatelessWidget {
  const CommentTile({
    super.key,
    required this.comment,
    required this.myReaction,
    required this.currentUserId,
    required this.onReply,
  });

  final CommentEntity comment;
  final CommentReaction myReaction;
  final String? currentUserId;
  final VoidCallback onReply;

  bool get _isOwn => currentUserId != null && comment.userId == currentUserId;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    final cubit = context.read<CommentsCubit>();

    return Padding(
      padding: EdgeInsets.only(
        left: (comment.depth * 40).w,
        bottom: 16.h,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row: avatar (40) + name + verified + date + overflow.
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _Avatar(
                author: comment.author,
                size: 40.r,
                colors: colors,
                texts: texts,
              ),
              Gap(12.w),
              Flexible(
                child: Text(
                  comment.author.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: texts.body.semiBold().copyWith(
                        color: colors.text.primary,
                        fontSize: 14.sp,
                        height: 22 / 14,
                      ),
                ),
              ),
              if (comment.isVerified) ...[
                Gap(8.w),
                SvgPicture.asset(
                  PilotAssets.kStudyVerified,
                  width: 20.r,
                  height: 20.r,
                  colorFilter: ColorFilter.mode(
                    colors.primary.main,
                    BlendMode.srcIn,
                  ),
                ),
              ],
              Gap(8.w),
              Text(
                _formatCommentDate(comment.createdAt),
                style: texts.body.copyWith(
                  color: colors.text.secondary,
                  fontSize: 14.sp,
                  height: 22 / 14,
                ),
              ),
              // Angular `canReport()` — hides the menu on the user's own
              // comment and on verified ("Official Response") comments.
              if (!_isOwn && !comment.isVerified)
                _OverflowMenu(
                  commentId: comment.commentId,
                  colors: colors,
                  texts: texts,
                  context: context,
                ),
            ],
          ),
          // Body row: 40 spacer aligned with avatar + 12 gap + content.
          Padding(
            padding: EdgeInsets.only(left: 52.w, top: 8.h),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (comment.isPending)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          comment.commentText,
                          style: texts.body.copyWith(
                            color: colors.text.secondary,
                            fontSize: 14.sp,
                            height: 22 / 14,
                          ),
                        ),
                      ),
                      Gap(8.w),
                      SizedBox(
                        width: 12.r,
                        height: 12.r,
                        child: CircularProgressIndicator(
                          strokeWidth: 1.5,
                          color: colors.text.secondary,
                        ),
                      ),
                    ],
                  )
                else
                  Text(
                    comment.commentText,
                    style: texts.body.copyWith(
                      color: colors.text.primary,
                      fontSize: 14.sp,
                      height: 22 / 14,
                    ),
                  ),
                Gap(12.h),
                // Reactions: like + dislike (gap 16) | reply (gap 24).
                // The reply CTA is suppressed on reply tiles — the
                // backend caps nesting at one level
                // (`comment.service.ts:60-63`), so replies-of-replies
                // are forbidden. Mirrors Angular's
                // `comment-viewer.component.html:150-213`, which only
                // renders the reply control on top-level comments.
                Row(
                  children: [
                    _ReactionButton(
                      outlineAsset: PilotAssets.kStudyLikeOutline,
                      filledAsset: PilotAssets.kStudyLikeFilled,
                      count: comment.likesCount,
                      isActive: myReaction == CommentReaction.like,
                      activeColor: colors.primary.main,
                      onTap: () => cubit.toggleLike(comment.commentId),
                      texts: texts,
                      colors: colors,
                    ),
                    Gap(16.w),
                    _ReactionButton(
                      outlineAsset: PilotAssets.kStudyDislikeOutline,
                      filledAsset: PilotAssets.kStudyDislikeFilled,
                      count: comment.dislikesCount,
                      isActive: myReaction == CommentReaction.dislike,
                      activeColor: colors.error.main,
                      onTap: () => cubit.toggleDislike(comment.commentId),
                      texts: texts,
                      colors: colors,
                    ),
                    if (comment.isTopLevel) ...[
                      Gap(24.w),
                      _ReplyButton(
                        repliesCount: comment.repliesCount,
                        onTap: onReply,
                        colors: colors,
                        texts: texts,
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({
    required this.author,
    required this.size,
    required this.colors,
    required this.texts,
  });

  final CommentAuthorEntity author;
  final double size;
  final PilotColorTheme colors;
  final PilotTextTheme texts;

  @override
  Widget build(BuildContext context) {
    final placeholder = _Placeholder(
      size: size,
      initial: _initial,
      colors: colors,
      texts: texts,
    );
    if (author.imageUrl == null) return placeholder;
    return PilotNetworkImage(
      imageUrl: author.imageUrl,
      width: size,
      height: size,
      borderRadius: BorderRadius.circular(size / 2),
      placeholder: (_) => placeholder,
      errorWidget: (_) => placeholder,
    );
  }

  String get _initial {
    final name = author.displayName;
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({
    required this.size,
    required this.initial,
    required this.colors,
    required this.texts,
  });

  final double size;
  final String initial;
  final PilotColorTheme colors;
  final PilotTextTheme texts;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: colors.primary.bg,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        initial,
        style: texts.bodySmall.semiBold().copyWith(color: colors.primary.main),
      ),
    );
  }
}

class _ReactionButton extends StatelessWidget {
  const _ReactionButton({
    required this.outlineAsset,
    required this.filledAsset,
    required this.count,
    required this.isActive,
    required this.activeColor,
    required this.onTap,
    required this.texts,
    required this.colors,
  });

  final String outlineAsset;
  final String filledAsset;
  final int count;
  final bool isActive;
  final Color activeColor;
  final VoidCallback onTap;
  final PilotTextTheme texts;
  final PilotColorTheme colors;

  @override
  Widget build(BuildContext context) {
    final iconColor = isActive ? activeColor : colors.text.secondary;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SvgPicture.asset(
            isActive ? filledAsset : outlineAsset,
            width: 24.r,
            height: 24.r,
            colorFilter: ColorFilter.mode(iconColor, BlendMode.srcIn),
          ),
          Gap(4.w),
          Text(
            '$count',
            style: texts.body.copyWith(
              color: iconColor,
              fontSize: 14.sp,
              height: 22 / 14,
            ),
          ),
        ],
      ),
    );
  }
}

/// Reply CTA — 24r message icon + count or "Reply" label. Mirrors Figma
/// frame 3173:50907 (top-level: shows reply count) and 3173:50930 (reply:
/// shows the literal "Reply" CTA when count is zero).
class _ReplyButton extends StatelessWidget {
  const _ReplyButton({
    required this.repliesCount,
    required this.onTap,
    required this.colors,
    required this.texts,
  });

  final int repliesCount;
  final VoidCallback onTap;
  final PilotColorTheme colors;
  final PilotTextTheme texts;

  @override
  Widget build(BuildContext context) {
    final color = colors.text.secondary;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SvgPicture.asset(
            PilotAssets.kStudyMessage,
            width: 24.r,
            height: 24.r,
            colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
          ),
          Gap(4.w),
          Text(
            repliesCount > 0 ? '$repliesCount' : 'Reply',
            style: texts.body.copyWith(
              color: color,
              fontSize: 14.sp,
              height: 22 / 14,
            ),
          ),
        ],
      ),
    );
  }
}

/// Single-action overflow menu — only "Report" is offered.
///
/// Angular only renders the report flag for non-own non-verified comments
/// (`comment-viewer.component.html:107`); delete is not implemented in the
/// web app, so it is not offered here either. The caller already gates
/// visibility on `!_isOwn && !comment.isVerified`.
class _OverflowMenu extends StatelessWidget {
  const _OverflowMenu({
    required this.commentId,
    required this.colors,
    required this.texts,
    required this.context,
  });

  final String commentId;
  final PilotColorTheme colors;
  final PilotTextTheme texts;
  final BuildContext context;

  @override
  Widget build(BuildContext outerContext) {
    return PopupMenuButton<String>(
      padding: EdgeInsets.zero,
      icon: SvgPicture.asset(
        PilotAssets.kStudyEllipsis,
        width: 18.r,
        height: 18.r,
        colorFilter: ColorFilter.mode(colors.text.secondary, BlendMode.srcIn),
      ),
      onSelected: (value) {
        if (value == 'report' && outerContext.mounted) {
          ReportCommentSheet.show(outerContext, commentId);
        }
      },
      itemBuilder: (_) => [
        PopupMenuItem<String>(
          value: 'report',
          child: Row(
            children: [
              SvgPicture.asset(
                PilotAssets.kStudyFlag,
                width: 18.r,
                height: 18.r,
                colorFilter:
                    ColorFilter.mode(colors.text.secondary, BlendMode.srcIn),
              ),
              Gap(8.w),
              Text(
                'Report',
                style: texts.body.copyWith(color: colors.text.primary),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
