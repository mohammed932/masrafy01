part of '../questionnaire.imports.dart';

/// Shape-matched shimmer mirroring the matching-preview match cards
/// (Constitution Principle XXXIV).
class MatchingPreviewSkeleton extends StatelessWidget {
  const MatchingPreviewSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return MasrafyShimmer(
      child: ListView(
        padding: const EdgeInsetsDirectional.all(16),
        children: [
          for (var card = 0; card < 3; card++) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsetsDirectional.all(16),
              decoration: BoxDecoration(
                color: colors.bg.container,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: colors.border.main),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  MasrafyShimmerLine(width: 180.w, height: 16),
                  Gap(6.h),
                  MasrafyShimmerLine(width: 120.w, height: 12),
                  Gap(16.h),
                  Row(
                    children: [
                      Expanded(child: MasrafyShimmerLine(height: 14.h)),
                      Gap(16.w),
                      Expanded(child: MasrafyShimmerLine(height: 14.h)),
                    ],
                  ),
                  Gap(16.h),
                  const MasrafyShimmerBox(width: 90, height: 24, radius: 6),
                ],
              ),
            ),
            Gap(12.h),
          ],
        ],
      ),
    );
  }
}
