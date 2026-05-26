import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';

class PilotShimmerBox extends StatelessWidget {
  const PilotShimmerBox({
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
    final colors = PilotColorTheme.of(context);
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
