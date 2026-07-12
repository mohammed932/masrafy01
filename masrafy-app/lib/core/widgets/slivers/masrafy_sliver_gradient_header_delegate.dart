import 'package:flutter/material.dart';
import 'package:app/core/widgets/common/masrafy_gradient_header.dart';

/// Collapsing [SliverPersistentHeaderDelegate] for the brand gradient hero.
///
/// As the user scrolls, `shrinkOffset` grows from 0 (fully expanded) to
/// `maxExtent - minExtent` (fully collapsed). We map that to a normalized
/// progress `t` in [0, 1] and hand it to [MasrafyGradientHeader] via its
/// `collapseProgress`, which fades the subtitle and scales/indents the title
/// up toward a compact bar. The gradient and the pinned glass back button are
/// preserved across the whole range — the brand styling lives in one place
/// (Principle XXXIII), this only owns the sliver mechanics.
///
/// Both extents are *physical pixels* (already `.h`-scaled by the caller),
/// because slivers measure in layout pixels — the delegate must not re-apply
/// flutter_screenutil scaling. The header is painted at the current (shrinking)
/// extent so its bottom-aligned title rises into the compact bar.
class MasrafySliverGradientHeaderDelegate
    extends SliverPersistentHeaderDelegate {
  const MasrafySliverGradientHeaderDelegate({
    required this.title,
    required this.subtitle,
    required this.expandedHeight,
    required this.collapsedHeight,
    this.onBack,
    this.action,
    this.bottom,
  });

  final String title;
  final String subtitle;

  /// Fully-expanded height in physical pixels (e.g. `300.h`).
  final double expandedHeight;

  /// Fully-collapsed height in physical pixels: safe-area top + a compact bar
  /// (e.g. `MediaQuery.viewPadding.top + kToolbarHeight`).
  final double collapsedHeight;

  final VoidCallback? onBack;

  /// Optional trailing affordance pinned top-end over the gradient (forwarded to
  /// [MasrafyGradientHeader.action]).
  final Widget? action;

  /// Optional widget rendered under the subtitle inside the gradient (e.g. the
  /// questionnaire's segmented progress bar). It lives in the header's expanded
  /// hero layer, so it fades out with the title/subtitle as the header
  /// collapses — no extra wiring. Its height must already be folded into
  /// [expandedHeight] via `MasrafyGradientHeader.expandedHeightFor(bottomExtent:)`,
  /// so the delegate needs no separate `bottomExtent`.
  final Widget? bottom;

  @override
  double get maxExtent => expandedHeight;

  @override
  double get minExtent => collapsedHeight;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    final range = maxExtent - minExtent;
    final t = range <= 0 ? 0.0 : (shrinkOffset / range).clamp(0.0, 1.0);
    final currentHeight =
        (maxExtent - shrinkOffset).clamp(minExtent, maxExtent);

    return ClipRect(
      child: MasrafyGradientHeader(
        title: title,
        subtitle: subtitle,
        onBack: onBack,
        action: action,
        bottom: bottom,
        heightInPixels: currentHeight,
        collapseProgress: t,
      ),
    );
  }

  @override
  bool shouldRebuild(
    covariant MasrafySliverGradientHeaderDelegate oldDelegate,
  ) {
    return oldDelegate.title != title ||
        oldDelegate.subtitle != subtitle ||
        oldDelegate.expandedHeight != expandedHeight ||
        oldDelegate.collapsedHeight != collapsedHeight ||
        oldDelegate.onBack != onBack ||
        oldDelegate.action != action ||
        oldDelegate.bottom != bottom;
  }
}
