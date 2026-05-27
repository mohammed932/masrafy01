import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/widgets/buttons/masrafy_button_base.dart';

class MasrafySecondaryButton extends MasrafyButtonBase {
  const MasrafySecondaryButton({
    super.key,
    required super.label,
    required super.onPressed,
    super.icon,
    super.enabled,
    super.isLoading,
    super.width,
  });

  @override
  Color labelColor(MasrafyColorTheme colors) => colors.text.heading;

  @override
  Widget buildButton(BuildContext context, VoidCallback? onTap, Widget child) {
    final colors = MasrafyColorTheme.of(context);
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: colors.text.heading,
        side: BorderSide(color: colors.border.main),
        padding: EdgeInsets.symmetric(horizontal: 16.w),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24.r)),
      ),
      child: child,
    );
  }
}
