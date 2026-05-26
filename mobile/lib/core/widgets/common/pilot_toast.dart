import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:toastification/toastification.dart';

/// Themed toast notifications used app-wide.
///
/// Wrap the root [MaterialApp] with [ToastificationWrapper] (already done in
/// the app entry points) so every screen can call:
///
/// ```dart
/// PilotToast.error(context, 'Something went wrong');
/// PilotToast.success(context, 'Saved');
/// PilotToast.info(context, 'Heads up');
/// PilotToast.warning(context, 'Be careful');
/// ```
class PilotToast {
  PilotToast._();

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
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);

    final accent = switch (type) {
      ToastificationType.error => colors.error.main,
      ToastificationType.success => colors.success.main,
      ToastificationType.warning => colors.warning.main,
      ToastificationType.info => colors.primary.main,
    };

    final resolvedTitle = title ?? _defaultTitleFor(type);

    toastification.show(
      context: context,
      type: type,
      style: ToastificationStyle.flatColored,
      alignment: Alignment.topCenter,
      autoCloseDuration: duration,
      showProgressBar: false,
      // Close-button control landed in toastification ^3.x which requires a
      // newer Flutter SDK than the current pin. Default close button is OK.
      backgroundColor: colors.bg.container,
      foregroundColor: colors.text.heading,
      primaryColor: accent,
      borderRadius: BorderRadius.circular(12.r),
      borderSide: BorderSide(color: accent, width: 1),
      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
      icon: Icon(_iconFor(type), color: accent, size: 22.r),
      title: Text(
        resolvedTitle,
        style: texts.body.semiBold().copyWith(color: colors.text.heading),
      ),
      description: Text(
        message,
        style: texts.bodySmall.regular().copyWith(color: colors.text.secondary),
      ),
    );
  }

  static IconData _iconFor(ToastificationType type) => switch (type) {
        ToastificationType.error => Icons.error_outline,
        ToastificationType.success => Icons.check_circle_outline,
        ToastificationType.warning => Icons.warning_amber_outlined,
        ToastificationType.info => Icons.info_outline,
      };

  static String _defaultTitleFor(ToastificationType type) => switch (type) {
        ToastificationType.error => 'Error',
        ToastificationType.success => 'Success',
        ToastificationType.warning => 'Warning',
        ToastificationType.info => 'Info',
      };
}
