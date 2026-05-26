part of 'exam_reports_widgets.imports.dart';

/// Loading-state shimmer for the "All Users" list inside [SeenInExamSheet].
/// Mirrors the loaded layout (`_AllUsersList` rounded container + N country
/// rows separated by hairline dividers) so the perceptual jolt between
/// loading and loaded is minimal — same shape, just shimmered.
class AllUsersListSkeleton extends StatelessWidget {
  const AllUsersListSkeleton({super.key, this.rowCount = 4});

  final int rowCount;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.fill.handleBg,
        border: Border.all(color: colors.border.main, width: 0.8),
        borderRadius: BorderRadius.circular(20.r),
      ),
      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 16.h),
      child: PilotShimmer(
        child: Column(
          children: [
            for (int i = 0; i < rowCount; i++) ...[
              if (i > 0) ...[
                Gap(12.h),
                Container(height: 1, color: colors.border.main),
                Gap(12.h),
              ],
              const _CountryRowSkeleton(),
            ],
          ],
        ),
      ),
    );
  }
}

class _CountryRowSkeleton extends StatelessWidget {
  const _CountryRowSkeleton();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        PilotShimmerCircle(diameter: 22.r),
        Gap(12.w),
        Expanded(child: PilotShimmerLine(height: 16.h)),
        Gap(12.w),
        PilotShimmerLine(width: 32.w, height: 16.h),
        Gap(16.w),
        PilotShimmerCircle(diameter: 32.r),
      ],
    );
  }
}
