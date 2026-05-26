import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';

/// Shared scaffold for every Pilot button variant.
///
/// Subclasses implement two hooks:
///   * [labelColor] — color applied to label, icon, and loading spinner.
///   * [buildButton] — returns the Material button wrapping [child] with
///     its own [ButtonStyle] (background, border, disabled colors, …).
abstract class PilotButtonBase extends StatelessWidget {
  const PilotButtonBase({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.enabled = true,
    this.isLoading = false,
    this.width,
  });

  final String label;
  final VoidCallback? onPressed;
  final Widget? icon;
  final bool enabled;
  final bool isLoading;
  final double? width;

  @protected
  Color labelColor(PilotColorTheme colors);

  @protected
  Widget buildButton(BuildContext context, VoidCallback? onTap, Widget child);

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final text = PilotTextTheme.of(context);
    final effectiveOnPressed = (enabled && !isLoading) ? onPressed : null;
    final fg = labelColor(colors);

    return SizedBox(
      height: 40.h,
      width: width,
      child: buildButton(
        context,
        effectiveOnPressed,
        isLoading
            ? SizedBox(
                width: 18.r,
                height: 18.r,
                child: CircularProgressIndicator(strokeWidth: 2, color: fg),
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[
                    icon!,
                    SizedBox(width: 6.w),
                  ],
                  Text(
                    label,
                    style: text.body.semiBold().copyWith(color: fg),
                  ),
                ],
              ),
      ),
    );
  }
}
