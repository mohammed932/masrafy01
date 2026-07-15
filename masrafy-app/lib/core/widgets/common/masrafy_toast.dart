import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:toastification/toastification.dart';

/// Themed toast notifications used app-wide.
///
/// Wrap the root [MaterialApp] with [ToastificationWrapper] (already done in
/// the app entry points) so every screen can call:
///
/// ```dart
/// MasrafyToast.error(context, 'Something went wrong');
/// MasrafyToast.success(context, 'Saved');
/// MasrafyToast.info(context, 'Heads up');
/// MasrafyToast.warning(context, 'Be careful');
/// ```
///
/// Rendered via a fully custom card ([_MasrafyToastCard]) rather than a
/// toastification built-in style, so it reads as a floating, brand-themed
/// pill: accent icon chip, soft shadow, optional title, tap-to-dismiss.
class MasrafyToast {
  MasrafyToast._();

  static const _kDefaultDuration = Duration(seconds: 4);

  static void error(
    BuildContext context,
    String message, {
    String? title,
    Duration duration = _kDefaultDuration,
  }) {
    _show(
      context,
      type: ToastificationType.error,
      title: title,
      message: message,
      duration: duration,
    );
  }

  static void success(
    BuildContext context,
    String message, {
    String? title,
    Duration duration = _kDefaultDuration,
  }) {
    _show(
      context,
      type: ToastificationType.success,
      title: title,
      message: message,
      duration: duration,
    );
  }

  static void info(
    BuildContext context,
    String message, {
    String? title,
    Duration duration = _kDefaultDuration,
  }) {
    _show(
      context,
      type: ToastificationType.info,
      title: title,
      message: message,
      duration: duration,
    );
  }

  static void warning(
    BuildContext context,
    String message, {
    String? title,
    Duration duration = _kDefaultDuration,
  }) {
    _show(
      context,
      type: ToastificationType.warning,
      title: title,
      message: message,
      duration: duration,
    );
  }

  static void _show(
    BuildContext context, {
    required ToastificationType type,
    required String message,
    required Duration duration,
    String? title,
  }) {
    // Snapshot the theme now so the toast (rendered in the root overlay, which
    // is NOT a descendant of the screen's theme provider) keeps brand colors.
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);

    toastification.showCustom(
      context: context,
      alignment: Alignment.topCenter,
      autoCloseDuration: duration,
      animationDuration: const Duration(milliseconds: 340),
      animationBuilder: (context, animation, alignment, child) {
        final curved = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutBack,
          reverseCurve: Curves.easeInCubic,
        );
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0, -0.35),
              end: Offset.zero,
            ).animate(curved),
            child: child,
          ),
        );
      },
      builder: (context, item) => _MasrafyToastCard(
        colors: colors,
        texts: texts,
        type: type,
        title: title,
        message: message,
        onDismiss: () => toastification.dismiss(item),
      ),
    );
  }
}

/// Floating brand-themed toast card. One accent per [ToastificationType],
/// resolved from the theme's brand tones (never a raw hex — Principle VIII).
class _MasrafyToastCard extends StatelessWidget {
  const _MasrafyToastCard({
    required this.colors,
    required this.texts,
    required this.type,
    required this.message,
    required this.onDismiss,
    this.title,
  });

  final MasrafyColorTheme colors;
  final MasrafyTextTheme texts;
  final ToastificationType type;
  final String message;
  final String? title;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final tone = switch (type) {
      ToastificationType.error => colors.error,
      ToastificationType.success => colors.success,
      ToastificationType.warning => colors.warning,
      ToastificationType.info => colors.primary,
    };
    final hasTitle = title != null && title!.trim().isNotEmpty;

    return SafeArea(
      bottom: false,
      minimum: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: 440.w),
          child: Material(
            color: Colors.transparent,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: colors.bg.container,
                borderRadius: BorderRadius.circular(16.r),
                border: Border.all(color: colors.border.secondary),
                boxShadow: [
                  BoxShadow(
                    color: colors.bg.solid.withValues(alpha: 0.12),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16.r),
                child: IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Accent spine.
                      Container(width: 4.w, color: tone.main),
                      Expanded(
                        child: Padding(
                          padding: EdgeInsets.fromLTRB(
                              12.w, 12.h, 8.w, 12.h),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              // Icon chip.
                              Container(
                                width: 36.r,
                                height: 36.r,
                                decoration: BoxDecoration(
                                  color: tone.bg,
                                  borderRadius: BorderRadius.circular(10.r),
                                ),
                                child: Icon(
                                  _iconFor(type),
                                  color: tone.main,
                                  size: 20.r,
                                ),
                              ),
                              _Gap(12.w),
                              Expanded(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    if (hasTitle) ...[
                                      Text(
                                        title!,
                                        style: texts.body
                                            .semiBold()
                                            .copyWith(
                                                color: colors.text.heading),
                                      ),
                                      _Gap(2.h),
                                    ],
                                    Text(
                                      message,
                                      style: (hasTitle
                                              ? texts.bodySmall.regular()
                                              : texts.body.medium())
                                          .copyWith(
                                        color: hasTitle
                                            ? colors.text.secondary
                                            : colors.text.heading,
                                        height: 1.35,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              _Gap(4.w),
                              // Dismiss.
                              InkWell(
                                onTap: onDismiss,
                                borderRadius: BorderRadius.circular(20.r),
                                child: Padding(
                                  padding: EdgeInsets.all(6.r),
                                  child: Icon(
                                    Icons.close_rounded,
                                    size: 18.r,
                                    color: colors.text.tertiary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  IconData _iconFor(ToastificationType type) => switch (type) {
        ToastificationType.error => Icons.error_outline_rounded,
        ToastificationType.success => Icons.check_circle_outline_rounded,
        ToastificationType.warning => Icons.warning_amber_rounded,
        ToastificationType.info => Icons.info_outline_rounded,
      };
}

/// Tiny sized-box gap so we don't depend on the `gap` package here.
class _Gap extends StatelessWidget {
  const _Gap(this.size);
  final double size;
  @override
  Widget build(BuildContext context) => SizedBox(width: size, height: size);
}
