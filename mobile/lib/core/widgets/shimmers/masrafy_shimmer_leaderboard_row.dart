import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer_circle.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer_line.dart';

/// Shimmer placeholder for a leaderboard-style row:
/// rank + avatar + name (expanded) + trailing meta.
///
/// Owns the single `MasrafyShimmer` wrapper — callers MUST NOT wrap in
/// another `MasrafyShimmer` (Principle X: one shimmer per skeleton).
class MasrafyShimmerLeaderboardRow extends StatelessWidget {
  const MasrafyShimmerLeaderboardRow({
    super.key,
    required this.body,
    required this.trailing,
    this.padding,
    this.rankBoxWidth = 28,
    this.rankLineWidth = 20,
    this.gap = 10,
    this.avatarDiameter = 36,
  });

  final Widget body;
  final Widget trailing;
  final EdgeInsetsGeometry? padding;
  final double rankBoxWidth;
  final double rankLineWidth;
  final double gap;
  final double avatarDiameter;

  @override
  Widget build(BuildContext context) {
    final row = Row(
      children: [
        SizedBox(
          width: rankBoxWidth.w,
          child: MasrafyShimmerLine(width: rankLineWidth, height: 14),
        ),
        Gap(gap.w),
        MasrafyShimmerCircle(diameter: avatarDiameter),
        Gap(gap.w),
        Expanded(child: body),
        trailing,
      ],
    );
    return MasrafyShimmer(
      child: padding == null ? row : Padding(padding: padding!, child: row),
    );
  }
}
