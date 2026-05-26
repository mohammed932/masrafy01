import 'package:flutter/material.dart';

/// Fixed-height [SliverPersistentHeaderDelegate] that paints a single child.
///
/// Use with `SliverPersistentHeader(floating: true, ...)` for a header that
/// hides on scroll-down and reappears on scroll-up, or with
/// `SliverPersistentHeader(pinned: true, ...)` to keep it fixed at the top.
///
/// `shouldRebuild` compares fields (height + child reference), so the header
/// subtree is reused across rebuilds when the parent passes the same widget.
class PilotPersistentHeaderDelegate extends SliverPersistentHeaderDelegate {
  const PilotPersistentHeaderDelegate({
    required this.height,
    required this.child,
  });

  final double height;
  final Widget child;

  @override
  double get minExtent => height;

  @override
  double get maxExtent => height;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return ClipRect(child: SizedBox(height: height, child: child));
  }

  @override
  bool shouldRebuild(covariant PilotPersistentHeaderDelegate old) =>
      old.height != height || old.child != child;
}
