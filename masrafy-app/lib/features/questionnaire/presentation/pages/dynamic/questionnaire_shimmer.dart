import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer_box.dart';

/// Shape-matched skeleton for a questionnaire step (Principle XXXIV / A34): a
/// hero band over a sheet of label + field placeholders, mirroring the loaded
/// layout. Rendered whenever the cubit is loading, so it re-fires on every
/// reload — not only first load.
class QuestionnaireShimmer extends StatelessWidget {
  const QuestionnaireShimmer({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final topInset = MediaQuery.of(context).viewPadding.top;

    return MasrafyShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hero band (mirrors the expanded gradient hero + progress bar).
          Container(
            width: double.infinity,
            height: topInset + 176.h,
            color: colors.bg.layout,
          ),
          Padding(
            padding: EdgeInsetsDirectional.fromSTEB(24.w, 28.h, 24.w, 24.h),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < 4; i++) ...[
                  if (i > 0) Gap(20.h),
                  const MasrafyShimmerBox(width: 160, height: 12, radius: 4),
                  Gap(8.h),
                  const MasrafyShimmerBox(height: 44, radius: 12),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
