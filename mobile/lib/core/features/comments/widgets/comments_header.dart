part of 'comments_widgets.imports.dart';

/// Pinned-header height used by the comments-panel `SliverPersistentHeader`.
const double _kCommentsHeaderHeight = 52;

/// Comments-list header — bold "Comments" title + teal count badge on
/// the left, sort pill on the right. Uses `PopupMenuButton` (Material
/// standard) so the sort menu auto-anchors directly under the pill.
class _Header extends StatelessWidget {
  const _Header(
      {required this.colors, required this.texts, required this.questionId});

  final PilotColorTheme colors;
  final PilotTextTheme texts;
  final String questionId;

  String _sortLabel(CommentSortOption sort) =>
      sort == CommentSortOption.likes ? 'Most Liked' : 'Most Recent';

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 10.h),
      child: Row(
        children: [
          BlocBuilder<CommentsCubit, CommentsState>(
            buildWhen: (p, c) => c.comments.length != p.comments.length,
            builder: (context, state) => Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Comments',
                  style: texts.body
                      .semiBold()
                      .copyWith(color: colors.text.primary),
                ),
                Gap(6.w),
                Container(
                  padding:
                      EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
                  decoration: BoxDecoration(
                    color: colors.primary.main,
                    borderRadius: BorderRadius.circular(10.r),
                  ),
                  child: Text(
                    '${state.comments.length}',
                    style: texts.bodySmall.copyWith(color: colors.white),
                  ),
                ),
              ],
            ),
          ),
          const Spacer(),
          BlocBuilder<CommentsCubit, CommentsState>(
            buildWhen: (p, c) => c.sort != p.sort,
            builder: (context, state) {
              final cubit = context.read<CommentsCubit>();
              return PilotPopupMenu<CommentSortOption>(
                selectedValue: state.sort,
                onSelected: (sort) => cubit.changeSort(questionId, sort),
                options: [
                  for (final option in CommentSortOption.values)
                    PilotPopupMenuOption(
                      value: option,
                      label: _sortLabel(option),
                    ),
                ],
                child: Container(
                  padding:
                      EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
                  decoration: BoxDecoration(
                    color: colors.fill.secondary,
                    border: Border.all(color: colors.border.main),
                    borderRadius: BorderRadius.circular(20.r),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _sortLabel(state.sort),
                        style: texts.bodySmall
                            .copyWith(color: colors.text.secondary),
                      ),
                      Gap(4.w),
                      SvgPicture.asset(
                        PilotAssets.kArrowDown,
                        width: 10.r,
                        height: 10.r,
                        colorFilter: ColorFilter.mode(
                            colors.text.secondary, BlendMode.srcIn),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
