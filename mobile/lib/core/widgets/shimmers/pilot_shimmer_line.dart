import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';

class PilotShimmerLine extends StatelessWidget {
  const PilotShimmerLine({
    super.key,
    this.width,
    this.height = 12,
  });

  final double? width;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    return Container(
      width: width != null ? width!.w : double.infinity,
      height: height.h,
      decoration: BoxDecoration(
        color: colors.bg.layout,
        borderRadius: BorderRadius.circular(4.r),
      ),
    );
  }
}
