import 'package:flutter/widgets.dart';

/// Republishes the live software-keyboard inset so widgets INSIDE a
/// `Scaffold` body can see it.
///
/// `Scaffold(resizeToAvoidBottomInset: true)` wraps its body in a MediaQuery
/// with `viewInsets.bottom` removed — that is how it shrinks the body — so a
/// descendant always reads `0` and can never react to the keyboard. Mount this
/// ABOVE the `Scaffold`, where the real inset is still visible, and read it
/// below via [of] / [progressOf].
///
/// ## Never smooth this value
///
/// The platform already delivers it as a per-frame animation:
///
/// * iOS — `FlutterViewController` animates a hidden `keyboardAnimationView`
///   with the keyboard notification's own duration + curve, and a VSync client
///   samples its presentation layer into the viewport metrics every frame.
/// * Android API >= 30 — `ImeSyncDeferringInsetsCallback` defers the platform's
///   single final-state inset and re-dispatches from `WindowInsetsAnimation
///   .Callback.onProgress`, once per frame.
///
/// So the inset is ALREADY in exact sync with the keyboard, and re-animating it
/// makes motion worse, not better. Every `ImplicitlyAnimatedWidget`
/// (`AnimatedPadding`, `AnimatedContainer`, `TweenAnimationBuilder`) restarts
/// its controller from zero on each retarget; retargeted every frame it
/// degenerates into an exponential follower that trails the keyboard by ~100ms.
/// The same applies to hand-rolled `AnimationController.animateTo` per frame.
/// Read the value, pass it through, animate nothing.
///
/// Android API <= 29 has no `WindowInsetsAnimation`, so the engine falls back to
/// a one-shot heuristic and the inset arrives as a single step. That is a
/// platform limit; smoothing it here would damage the two platforms that are
/// already correct, so consumers accept the step instead.
class MasrafyKeyboardInset extends StatelessWidget {
  const MasrafyKeyboardInset({super.key, required this.child});

  final Widget child;

  /// Keyboard travel (logical px) over which [progressOf] runs 0 -> 1.
  ///
  /// Deliberately shorter than any real keyboard (the smallest phone IMEs are
  /// ~220 logical px), so collapse-on-keyboard finishes partway up the slide
  /// instead of lagging to the very last frame. Raw logical px, NOT `.h`-scaled:
  /// `viewInsets` is reported in logical px and mixing in a screenutil-scaled
  /// constant would compare two different units.
  static const double _kCollapseTravel = 160;

  /// Live keyboard inset in logical px, or `0` with no [MasrafyKeyboardInset]
  /// ancestor. Establishes a dependency: callers rebuild each keyboard frame.
  static double of(BuildContext context) =>
      context
          .dependOnInheritedWidgetOfExactType<_KeyboardInsetScope>()
          ?.inset ??
      0;

  /// [of] normalised to 0..1 over [_kCollapseTravel] — the driver for anything
  /// that should shrink as the keyboard rises (e.g. a gradient hero's
  /// `expandedHeight`). Rides the platform animation 1:1 by construction.
  static double progressOf(BuildContext context) =>
      progressForInset(of(context));

  /// [progressOf] for a raw inset the caller already read for itself.
  ///
  /// A screen that builds its whole Scaffold in one method can skip mounting a
  /// [MasrafyKeyboardInset] and just read `MediaQuery.viewInsetsOf(context)
  /// .bottom` ABOVE its Scaffold — same value, no wrapper. The widget earns its
  /// keep only where a per-frame rebuild of the whole subtree is expensive (the
  /// questionnaire's `PageView`, which mounts a full step form per page); there
  /// it confines the rebuild to the widgets that actually asked for the inset.
  static double progressForInset(double inset) =>
      (inset / _kCollapseTravel).clamp(0.0, 1.0);

  @override
  Widget build(BuildContext context) {
    // Aspect-scoped read: only THIS element rebuilds per keyboard frame. Since
    // `child` is the same widget instance the parent built last, Element
    // .updateChild short-circuits on identity and the Scaffold subtree below is
    // not rebuilt — only the descendants that actually called of()/progressOf().
    return _KeyboardInsetScope(
      inset: MediaQuery.viewInsetsOf(context).bottom,
      child: child,
    );
  }
}

class _KeyboardInsetScope extends InheritedWidget {
  const _KeyboardInsetScope({required this.inset, required super.child});

  final double inset;

  @override
  bool updateShouldNotify(_KeyboardInsetScope oldWidget) =>
      oldWidget.inset != inset;
}
