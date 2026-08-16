import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

/// Fades + lifts one choice card into place, [index] slots after the one above.
///
/// A controller-free stagger: each child owns a [TweenAnimationBuilder] whose
/// duration is the shared travel time plus its own offset, so the list resolves
/// top-to-bottom without a `TickerProvider` or a shared `AnimationController` to
/// dispose. That matters because the cards are rebuilt on every selection — a
/// controller would either restart on each tap or have to be lifted into a
/// StatefulWidget that outlives the list it animates.
///
/// Replays per step, not per rebuild: the caller keys the step so a new
/// [TweenAnimationBuilder] is built when the step changes and the existing one is
/// reused (already at 1.0) when a tap rebuilds the same step. Without that key
/// every selection would re-run the entrance under the customer's finger.
class LoanSetupStagger extends StatelessWidget {
  const LoanSetupStagger({
    super.key,
    required this.index,
    required this.child,
  });

  final int index;
  final Widget child;

  static const Duration _travel = Duration(milliseconds: 300);
  static const Duration _step = Duration(milliseconds: 55);

  @override
  Widget build(BuildContext context) {
    final delay = _step * index;
    final total = _travel + delay;
    // Where in the combined timeline this child's own motion starts. Expressed
    // as a fraction so the Interval and the duration cannot drift apart.
    final start = delay.inMilliseconds / total.inMilliseconds;

    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: 1),
      duration: total,
      curve: Interval(start, 1, curve: Curves.easeOutCubic),
      builder: (context, t, child) => Opacity(
        opacity: t,
        // Rises rather than slides sideways: a horizontal entrance would fight
        // the PageView's own slide, and would need mirroring for RTL.
        child: Transform.translate(offset: Offset(0, (1 - t) * 14.h), child: child),
      ),
      child: child,
    );
  }
}
