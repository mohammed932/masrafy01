import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';

class MasrafyShimmerLine extends StatelessWidget {
  const MasrafyShimmerLine({
    super.key,
    this.width,
    this.height = 12,
  });

  final double? width;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
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
