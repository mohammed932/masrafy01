import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';

class MasrafyShimmerBox extends StatelessWidget {
  const MasrafyShimmerBox({
    super.key,
    this.width,
    required this.height,
    this.radius = 8,
  });

  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return Container(
      width: width != null ? width!.w : double.infinity,
      height: height.h,
      decoration: BoxDecoration(
        color: colors.bg.layout,
        borderRadius: BorderRadius.circular(radius.r),
      ),
    );
  }
}
