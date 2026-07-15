import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/shimmers/masrafy_shimmer.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer_box.dart';

/// Shape-matched skeleton for a questionnaire step (Principle XXXIV / A34): a
/// hero band over a sheet of label + field placeholders, mirroring the loaded
/// layout. Rendered whenever the cubit is loading, so it re-fires on every
/// reload — not only first load.
class QuestionnaireShimmer extends StatelessWidget {
  const QuestionnaireShimmer({super.key});

  /// Per-field label widths so the sheet reads as varied questions rather than
  /// identical bars.
  static const _labelWidths = <double>[168, 132, 190, 148];

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).viewPadding.top;

    // `Shimmer.fromColors` masks every opaque pixel, so a filled hero band would
    // sweep as one solid slab. Instead lay out the hero's actual silhouette —
    // back chip, title, subtitle, progress bar — as separate placeholders on a
    // transparent ground, mirroring MasrafyGradientHeader (A35).
    return MasrafyShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsetsDirectional.fromSTEB(24.w, topInset + 18.h, 24.w, 18.h),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const MasrafyShimmerBox(width: 44, height: 44, radius: 14),
                Gap(24.h),
                const MasrafyShimmerBox(width: 210, height: 22, radius: 9),
                Gap(11.h),
                const MasrafyShimmerBox(width: 150, height: 13, radius: 6),
                Gap(22.h),
                const MasrafyShimmerBox(height: 6, radius: 999),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsetsDirectional.fromSTEB(24.w, 20.h, 24.w, 24.h),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < 4; i++) ...[
                  if (i > 0) Gap(20.h),
                  MasrafyShimmerBox(
                    width: _labelWidths[i % _labelWidths.length],
                    height: 12,
                    radius: 6,
                  ),
                  Gap(9.h),
                  const MasrafyShimmerBox(height: 52, radius: 14),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
