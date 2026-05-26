part of 'comments_widgets.imports.dart';

/// "Load more comments" trigger rendered at the tail of the list when
/// `state.hasMore` is true. Shows a primary-tinted spinner while the
/// next page is fetching.
class _LoadMoreButton extends StatelessWidget {
  const _LoadMoreButton({
    required this.isLoading,
    required this.colors,
    required this.texts,
    required this.onTap,
  });

  final bool isLoading;
  final PilotColorTheme colors;
  final PilotTextTheme texts;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 12.h),
        child: isLoading
            ? SizedBox(
                width: 20.r,
                height: 20.r,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: colors.primary.main,
                ),
              )
            : TextButton(
                onPressed: onTap,
                child: Text(
                  'Load more comments',
                  style: texts.body.copyWith(color: colors.primary.main),
                ),
              ),
      ),
    );
  }
}
