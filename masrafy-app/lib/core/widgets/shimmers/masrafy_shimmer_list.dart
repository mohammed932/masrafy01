import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

/// Reusable shimmer list scaffold.
///
/// Mirrors the typical "loaded state" of a tab body: a vertical
/// [ListView.separated] with non-scrollable physics, a fixed [itemCount]
/// (default 5), and per-item placeholder built by [itemBuilder].
///
/// Use this whenever a screen's loaded state is "X repeated cards in a
/// scrolling column" so we don't duplicate the ListView wiring + paddings
/// across every tab skeleton.
class MasrafyShimmerList extends StatelessWidget {
  const MasrafyShimmerList({
    super.key,
    required this.itemBuilder,
    this.itemCount = 5,
    this.separation = 8,
    this.padding,
  });

  /// Number of placeholder cards to render. Defaults to 5.
  final int itemCount;

  /// Vertical gap between items in logical pixels (will be `.h`-scaled).
  final double separation;

  /// Optional padding around the list. Defaults to `EdgeInsets.symmetric(
  /// horizontal: 16, vertical: 8)` (the most common tab body padding).
  final EdgeInsets? padding;

  /// Builds one placeholder. Index is supplied for callers that vary widths
  /// across rows (e.g. alternating line lengths) — most callers ignore it.
  final Widget Function(BuildContext context, int index) itemBuilder;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: padding ?? EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itemCount,
      separatorBuilder: (_, __) => Gap(separation.h),
      itemBuilder: itemBuilder,
    );
  }
}
