import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/shimmers/masrafy_shimmer.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer_box.dart';

/// Shape-matched skeleton for a loan-setup step (Principle XXXIV / A34): the hero
/// silhouette over a sheet of choice-card placeholders, mirroring the loaded
/// layout. Rendered whenever the availability read is in flight, so it re-fires
/// on every reload — including after a category change — not only first load.
///
/// Laid out as separate placeholders on a transparent ground rather than as
/// filled bands: `Shimmer.fromColors` masks every opaque pixel, so a solid hero
/// block would sweep as one slab instead of reading as a header.
class LoanSetupShimmer extends StatelessWidget {
  const LoanSetupShimmer({super.key, this.cards = 3});

  /// How many card placeholders to lay out. Two on the income step, more on the
  /// program list — the caller says, so the skeleton matches what is coming.
  final int cards;

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).viewPadding.top;

    return MasrafyShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding:
                EdgeInsetsDirectional.fromSTEB(24.w, topInset + 18.h, 24.w, 18.h),
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
                const MasrafyShimmerBox(width: 190, height: 16, radius: 8),
                Gap(6.h),
                const MasrafyShimmerBox(width: 240, height: 12, radius: 6),
                Gap(18.h),
                for (var i = 0; i < cards; i++) ...[
                  if (i > 0) Gap(12.h),
                  // 78 ≈ the choice card's own height: 16r padding, a 44r icon,
                  // and a title over a subtitle.
                  const MasrafyShimmerBox(height: 78, radius: 18),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
