part of 'comments_widgets.imports.dart';

/// Facebook-style sticky reply input that floats above the keyboard
/// while the user is composing a reply. Mounts when
/// `state.replyToCommentId != null`, auto-focuses its text field so
/// the OS keyboard slides up immediately, and lifts above the keyboard
/// using `MediaQuery.viewInsetsOf(context).bottom`.
///
/// Layout (vertical):
///   - "Replying to {name} · Cancel" hint row.
///   - Pill input + circular send button beside it.
class _ReplyBottomBar extends StatefulWidget {
  const _ReplyBottomBar({
    required this.questionId,
    required this.colors,
    required this.texts,
  });

  final String questionId;
  final PilotColorTheme colors;
  final PilotTextTheme texts;

  @override
  State<_ReplyBottomBar> createState() => _ReplyBottomBarState();
}

class _ReplyBottomBarState extends State<_ReplyBottomBar> {
  late final TextEditingController _controller;
  late final FocusNode _focus;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: context.read<CommentsCubit>().state.composerText,
    );
    _focus = FocusNode();
    // Auto-focus on mount so the OS keyboard opens without an extra tap.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focus.requestFocus();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = widget.colors;
    final texts = widget.texts;
    return BlocConsumer<CommentsCubit, CommentsState>(
      listenWhen: (p, c) =>
          c.composerText != p.composerText &&
          c.composerText != _controller.text,
      listener: (_, state) {
        _controller.value = TextEditingValue(
          text: state.composerText,
          selection:
              TextSelection.collapsed(offset: state.composerText.length),
        );
      },
      buildWhen: (p, c) =>
          c.composerText != p.composerText ||
          c.isPosting != p.isPosting ||
          c.replyToCommentId != p.replyToCommentId,
      builder: (context, state) {
        final cubit = context.read<CommentsCubit>();
        final target = state.replyTarget;
        if (target == null) return const SizedBox.shrink();

        final canSend = state.canPost && !state.isPosting;
        final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;

        return Padding(
          padding: EdgeInsets.only(bottom: keyboardInset),
          child: Container(
            decoration: BoxDecoration(
              color: colors.bg.container,
              border: Border(top: BorderSide(color: colors.border.main)),
            ),
            padding: EdgeInsets.fromLTRB(16.w, 8.h, 16.w, 8.h),
            child: SafeArea(
              top: false,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Replying to ${target.author.displayName}',
                          style: texts.bodySmall
                              .copyWith(color: colors.text.secondary),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Gap(8.w),
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: cubit.cancelReply,
                        child: Text(
                          'Cancel',
                          style: texts.bodySmall.semiBold().copyWith(
                                color: colors.primary.main,
                              ),
                        ),
                      ),
                    ],
                  ),
                  Gap(6.h),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Container(
                          padding: EdgeInsets.symmetric(
                            horizontal: 16.w,
                            vertical: 8.h,
                          ),
                          decoration: BoxDecoration(
                            color: colors.fill.alter,
                            border:
                                Border.all(color: colors.primary.main),
                            borderRadius: BorderRadius.circular(20.r),
                          ),
                          child: TextField(
                            controller: _controller,
                            focusNode: _focus,
                            onChanged: cubit.updateComposer,
                            minLines: 1,
                            maxLines: 4,
                            maxLength: CommentEntity.maxCommentLength,
                            textAlignVertical: TextAlignVertical.center,
                            style: texts.bodyLarge.copyWith(
                              color: colors.text.heading,
                              fontSize: 16.sp,
                              height: 24 / 16,
                            ),
                            decoration: InputDecoration(
                              isCollapsed: true,
                              border: InputBorder.none,
                              hintText: 'Write a reply…',
                              hintStyle: texts.bodyLarge.copyWith(
                                color: colors.text.placeholder,
                                fontSize: 16.sp,
                                height: 24 / 16,
                              ),
                              counterText: '',
                            ),
                          ),
                        ),
                      ),
                      Gap(8.w),
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: canSend
                            ? () => cubit.postComment(widget.questionId)
                            : null,
                        child: Container(
                          width: 40.r,
                          height: 40.r,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: canSend
                                ? colors.primary.main
                                : colors.primary.main
                                    .withValues(alpha: 0.4),
                            shape: BoxShape.circle,
                          ),
                          child: state.isPosting
                              ? SizedBox(
                                  width: 18.r,
                                  height: 18.r,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: colors.white,
                                  ),
                                )
                              : SvgPicture.asset(
                                  PilotAssets.kStudySend,
                                  width: 18.r,
                                  height: 18.r,
                                  colorFilter: ColorFilter.mode(
                                    colors.white,
                                    BlendMode.srcIn,
                                  ),
                                ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
