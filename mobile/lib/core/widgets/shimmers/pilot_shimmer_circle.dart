import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';

class PilotShimmerCircle extends StatelessWidget {
  const PilotShimmerCircle({super.key, required this.diameter});

  final double diameter;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    return Container(
      width: diameter.r,
      height: diameter.r,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: colors.bg.layout,
      ),
    );
  }
}
