import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/widgets/buttons/pilot_button_base.dart';

class PilotPrimaryButton extends PilotButtonBase {
  const PilotPrimaryButton({
    super.key,
    required super.label,
    required super.onPressed,
    super.icon,
    super.enabled,
    super.isLoading,
    super.width,
  });

  @override
  Color labelColor(PilotColorTheme colors) => colors.white;

  @override
  Widget buildButton(BuildContext context, VoidCallback? onTap, Widget child) {
    final colors = PilotColorTheme.of(context);
    return ElevatedButton(
      onPressed: onTap,
      style: ElevatedButton.styleFrom(
        backgroundColor: colors.primary.main,
        disabledBackgroundColor: colors.primary.main.withValues(alpha: 0.4),
        foregroundColor: colors.white,
        disabledForegroundColor: colors.white.withValues(alpha: 0.6),
        elevation: 0,
        padding: EdgeInsets.symmetric(horizontal: 16.w),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24.r)),
      ),
      child: child,
    );
  }
}
