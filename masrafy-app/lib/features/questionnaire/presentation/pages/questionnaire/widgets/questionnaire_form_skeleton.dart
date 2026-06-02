part of '../questionnaire.imports.dart';

/// Shape-matched shimmer mirroring the questionnaire form: a section
/// title followed by question prompts + radio rows (Constitution
/// Principle XXXIV — re-fires on every reload, never a bare spinner).
class QuestionnaireFormSkeleton extends StatelessWidget {
  const QuestionnaireFormSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return MasrafyShimmer(
      child: ListView(
        padding: const EdgeInsetsDirectional.all(16),
        children: [
          for (var group = 0; group < 2; group++) ...[
            MasrafyShimmerLine(width: 160.w, height: 18),
            Gap(16.h),
            for (var question = 0; question < 2; question++) ...[
              MasrafyShimmerLine(width: 220.w, height: 14),
              Gap(12.h),
              for (var option = 0; option < 3; option++) ...[
                Row(
                  children: [
                    const MasrafyShimmerBox(
                      width: 20,
                      height: 20,
                      radius: 10,
                    ),
                    Gap(12.w),
                    MasrafyShimmerLine(width: 140.w, height: 12),
                  ],
                ),
                Gap(10.h),
              ],
              Gap(8.h),
            ],
            Gap(16.h),
          ],
        ],
      ),
    );
  }
}
