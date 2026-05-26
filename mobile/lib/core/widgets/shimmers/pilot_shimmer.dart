import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:shimmer/shimmer.dart';

class PilotShimmer extends StatelessWidget {
  const PilotShimmer({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final isLight = colors.brightness == Brightness.light;
    return Shimmer.fromColors(
      // Light: #D9D9D9 → #F5F5F5 — visible sweep against white card background
      // Dark:  #303030 → #424242 — visible sweep against #1F1F1F card background
      baseColor: isLight ? colors.border.main : colors.fill.handleBg,
      highlightColor: isLight ? colors.bg.layout : colors.border.main,
      child: child,
    );
  }
}
