import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer_line.dart';

/// Placeholder for the "Select All / Deselect All" text-button row that
/// sits above paginated lists in many of the Reports tabs (notes,
/// comments, flagged, difficult). One short shimmer line, left-aligned,
/// in a 16.w horizontal × 4.h vertical padded row that matches the real
/// `Row + TextButton` layout.
class MasrafyShimmerSelectAllRow extends StatelessWidget {
  const MasrafyShimmerSelectAllRow({
    super.key,
    this.labelWidth = 80,
    this.labelHeight = 14,
    this.padding,
  });

  final double labelWidth;
  final double labelHeight;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          padding ?? EdgeInsets.symmetric(horizontal: 16.w, vertical: 4.h),
      child: MasrafyShimmer(
        child: Row(
          children: [
            MasrafyShimmerLine(width: labelWidth, height: labelHeight),
          ],
        ),
      ),
    );
  }
}
