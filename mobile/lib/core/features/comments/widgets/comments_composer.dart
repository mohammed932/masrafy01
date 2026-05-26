part of 'comments_widgets.imports.dart';

/// Pixel-perfect mirror of Figma frame 3173:50872 — the "Leave a comment"
/// expanded form: label + auto-growing textarea + caption + button row
/// (Cancel + Add Comment).
class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.questionId,
    required this.colors,
    required this.texts,
  });

  final TextEditingController controller;
  final String questionId;
  final PilotColorTheme colors;
  final PilotTextTheme texts;

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<CommentsCubit, CommentsState>(
      listenWhen: (p, c) =>
          c.composerText != p.composerText &&
          c.composerText != controller.text,
      listener: (_, state) {
        controller.text = state.composerText;
        controller.selection =
            TextSelection.collapsed(offset: controller.text.length);
      },
      buildWhen: (p, c) =>
          c.composerText != p.composerText ||
          c.isPosting != p.isPosting ||
          c.replyToCommentId != p.replyToCommentId,
      builder: (context, state) {
        final cubit = context.read<CommentsCubit>();
        return Padding(
          padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 12.h),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Padding(
                    padding: EdgeInsets.only(bottom: 8.h),
                    child: Text(
                      'Leave a comment',
                      style: texts.body.copyWith(
                        color: colors.text.heading,
                        fontSize: 14.sp,
                        height: 22 / 14,
                      ),
                    ),
                  ),
                  Container(
                    width: double.infinity,
                    padding: EdgeInsets.symmetric(
                      horizontal: 16.w,
                      vertical: 8.h,
                    ),
                    decoration: BoxDecoration(
                      color: colors.fill.alter,
                      border: Border.all(color: colors.primary.main),
                      borderRadius: BorderRadius.circular(20.r),
                    ),
                    child: TextField(
                      controller: controller,
                      onChanged: cubit.updateComposer,
                      minLines: 2,
                      maxLines: null,
                      maxLength: CommentEntity.maxCommentLength,
                      textAlignVertical: TextAlignVertical.top,
                      style: texts.bodyLarge.copyWith(
                        color: colors.text.heading,
                        fontSize: 16.sp,
                        height: 24 / 16,
                      ),
                      decoration: InputDecoration(
                        isCollapsed: true,
                        border: InputBorder.none,
                        hintText:
                            'Share what you think or ask a question…',
                        hintStyle: texts.bodyLarge.copyWith(
                          color: colors.text.placeholder,
                          fontSize: 16.sp,
                          height: 24 / 16,
                        ),
                        counterText: '',
                      ),
                    ),
                  ),
                  Padding(
                    padding: EdgeInsets.only(top: 2.h),
                    child: _GuidelinesCaption(
                      colors: colors,
                      texts: texts,
                      onTap: () => CommunityGuidelinesSheet.show(context),
                    ),
                  ),
                ],
              ),
              Gap(16.h),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  _ComposerButton(
                    label: 'Cancel',
                    isPrimary: false,
                    onTap: state.composerText.isEmpty &&
                            state.replyToCommentId == null
                        ? null
                        : () {
                            cubit.updateComposer('');
                            controller.clear();
                            if (state.replyToCommentId != null) {
                              cubit.cancelReply();
                            }
                          },
                    colors: colors,
                    texts: texts,
                  ),
                  Gap(16.w),
                  _ComposerButton(
                    label: 'Add Comment',
                    isPrimary: true,
                    isLoading: state.isPosting,
                    onTap: state.canPost && !state.isPosting
                        ? () => cubit.postComment(questionId)
                        : null,
                    colors: colors,
                    texts: texts,
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}

/// "Add your input or ask something. After read the comment guidelines."
/// caption rendered with the "comment guidelines" segment semi-bold +
/// underlined and tappable. Mirrors Figma frame 3173:50872 caption.
class _GuidelinesCaption extends StatelessWidget {
  const _GuidelinesCaption({
    required this.colors,
    required this.texts,
    required this.onTap,
  });

  final PilotColorTheme colors;
  final PilotTextTheme texts;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final base = texts.bodySmall.copyWith(
      color: colors.text.placeholder,
      fontSize: 14.sp,
      height: 22 / 14,
    );
    return RichText(
      text: TextSpan(
        style: base,
        children: [
          const TextSpan(
            text: 'Add your input or ask something. After read the ',
          ),
          TextSpan(
            text: 'comment guidelines',
            style: base.copyWith(
              fontWeight: FontWeight.w600,
              decoration: TextDecoration.underline,
            ),
            recognizer: TapGestureRecognizer()..onTap = onTap,
          ),
          const TextSpan(text: '.'),
        ],
      ),
    );
  }
}

/// Cancel / Add Comment button. Cancel is a text-only h=40 pill;
/// Add Comment is a primary teal h=40 pill with white label. Both
/// match Figma frame 3173:50872's button row.
class _ComposerButton extends StatelessWidget {
  const _ComposerButton({
    required this.label,
    required this.isPrimary,
    required this.onTap,
    required this.colors,
    required this.texts,
    this.isLoading = false,
  });

  final String label;
  final bool isPrimary;
  final VoidCallback? onTap;
  final PilotColorTheme colors;
  final PilotTextTheme texts;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final isEnabled = onTap != null && !isLoading;
    final Color bg;
    final Color fg;
    if (isPrimary) {
      bg = isEnabled
          ? colors.primary.main
          : colors.primary.main.withValues(alpha: 0.4);
      fg = colors.white;
    } else {
      bg = Colors.transparent;
      fg = isEnabled ? colors.text.heading : colors.text.placeholder;
    }
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: isEnabled ? onTap : null,
      child: Container(
        height: 40.h,
        padding: EdgeInsets.symmetric(horizontal: 15.w),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(24.r),
        ),
        child: isLoading
            ? SizedBox(
                width: 18.r,
                height: 18.r,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: fg,
                ),
              )
            : Text(
                label,
                style: texts.bodyLarge.copyWith(
                  color: fg,
                  fontSize: 16.sp,
                  height: 24 / 16,
                ),
              ),
      ),
    );
  }
}
