import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// Shared toast surface. Concrete subclasses (`MasrafySuccessToast`,
/// `MasrafyErrorToast`, `MasrafyWarningToast`) supply the icon + tint;
/// this base owns the layout, dismissal, and overlay plumbing.
///
/// Anchored just below the OS status bar via an `OverlayEntry` rather
/// than a `SnackBar`. The previous implementation lifted a floating
/// SnackBar up with a computed bottom margin, but the math depends on
/// the SnackBar's *rendered* height — wrapped messages and dynamic
/// font sizes pushed it past `padding.top` and overlapped the status
/// bar. Positioning at `viewPadding.top + 12` is exact regardless of
/// content height.
///
/// Usage:
/// ```dart
/// const MasrafySuccessToast(message: 'Flag updated').show(context);
/// ```
abstract class MasrafyToast {
  const MasrafyToast({required this.message, this.duration});

  final String message;
  final Duration? duration;

  String get iconAsset;
  Color backgroundColor(MasrafyColorTheme colors);
  Color foregroundColor(MasrafyColorTheme colors) => colors.white;

  static const Duration _animation = Duration(milliseconds: 220);

  void show(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    final overlayState = Overlay.of(context, rootOverlay: true);

    final controller = AnimationController(
      vsync: overlayState,
      duration: _animation,
    );
    OverlayEntry? entry;
    var dismissed = false;

    Future<void> dismiss() async {
      if (dismissed) return;
      dismissed = true;
      try {
        await controller.reverse();
      } catch (_) {
        // animation can throw if the overlay is torn down mid-flight;
        // safe to ignore — we still need to remove the entry.
      }
      entry?.remove();
      controller.dispose();
    }

    entry = OverlayEntry(
      builder: (ctx) => _MasrafyToastView(
        controller: controller,
        message: message,
        iconAsset: iconAsset,
        backgroundColor: backgroundColor(colors),
        foregroundColor: foregroundColor(colors),
        textStyle: texts.body.medium().copyWith(color: foregroundColor(colors)),
        onTapDismiss: dismiss,
      ),
    );

    overlayState.insert(entry);
    controller.forward();

    Future.delayed(duration ?? const Duration(seconds: 2), dismiss);
  }
}

class _MasrafyToastView extends StatelessWidget {
  const _MasrafyToastView({
    required this.controller,
    required this.message,
    required this.iconAsset,
    required this.backgroundColor,
    required this.foregroundColor,
    required this.textStyle,
    required this.onTapDismiss,
  });

  final AnimationController controller;
  final String message;
  final String iconAsset;
  final Color backgroundColor;
  final Color foregroundColor;
  final TextStyle textStyle;
  final VoidCallback onTapDismiss;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    return Positioned(
      // `viewPadding.top` is the OS status-bar inset and survives
      // `MediaQuery.removePadding` (unlike `padding.top`), so the
      // toast lands in the same place whether `show` is called from
      // inside or outside a Scaffold.
      top: media.viewPadding.top + 12.h,
      left: 16.w,
      right: 16.w,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, -0.5),
          end: Offset.zero,
        ).animate(CurvedAnimation(parent: controller, curve: Curves.easeOut)),
        child: FadeTransition(
          opacity: controller,
          child: Material(
            color: Colors.transparent,
            child: GestureDetector(
              onTap: onTapDismiss,
              behavior: HitTestBehavior.opaque,
              child: Container(
                padding:
                    EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
                decoration: BoxDecoration(
                  color: backgroundColor,
                  borderRadius: BorderRadius.circular(12.r),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.18),
                      offset: const Offset(0, 4),
                      blurRadius: 12,
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    SvgPicture.asset(
                      iconAsset,
                      width: 20.r,
                      height: 20.r,
                      colorFilter:
                          ColorFilter.mode(foregroundColor, BlendMode.srcIn),
                    ),
                    Gap(12.w),
                    Expanded(child: Text(message, style: textStyle)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
