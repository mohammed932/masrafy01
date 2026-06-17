import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// Validation tint for a [MasrafyLabeledField] (Figma sign-up inputs:
/// neutral grey, green when valid, red when in error).
enum MasrafyFieldStatus { neutral, valid, error }

/// Uppercase label (optionally with a colored status dot) above a filled,
/// rounded text input, with an optional helper/error line below — the
/// sign-up input style from Figma `91:357`+. Generalizes the private
/// `_LabeledField` shipped inline in the login screen and is promoted here
/// per Principle XXXIII (shared on second use). State is fully external:
/// the caller owns the controller + `onChanged`.
class MasrafyLabeledField extends StatelessWidget {
  const MasrafyLabeledField({
    super.key,
    required this.label,
    required this.controller,
    required this.onChanged,
    this.hint,
    this.obscure = false,
    this.keyboardType,
    this.textInputAction,
    this.suffix,
    this.inputFormatters,
    this.status = MasrafyFieldStatus.neutral,
    this.helperText,
    this.showStatusDot = false,
  });

  final String label;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final String? hint;
  final bool obscure;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Widget? suffix;
  final List<TextInputFormatter>? inputFormatters;
  final MasrafyFieldStatus status;
  final String? helperText;
  final bool showStatusDot;

  Color _accent(MasrafyColorTheme colors) {
    switch (status) {
      case MasrafyFieldStatus.valid:
        return colors.success.main;
      case MasrafyFieldStatus.error:
        return colors.error.main;
      case MasrafyFieldStatus.neutral:
        return colors.border.main;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final accent = _accent(colors);
    final isNeutral = status == MasrafyFieldStatus.neutral;
    final fill = isNeutral ? colors.bg.layout : accent.withValues(alpha: 0.06);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            if (showStatusDot) ...[
              Container(
                width: 6.r,
                height: 6.r,
                decoration: BoxDecoration(
                  color: status == MasrafyFieldStatus.error
                      ? colors.error.main
                      : colors.success.main,
                  borderRadius: BorderRadius.circular(2.r),
                ),
              ),
              Gap(6.w),
            ],
            Text(
              label.toUpperCase(),
              style: text.caption.semiBold().copyWith(
                    color: colors.primary.main,
                    letterSpacing: 0.66,
                  ),
            ),
          ],
        ),
        Gap(6.h),
        TextField(
          controller: controller,
          onChanged: onChanged,
          obscureText: obscure,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          inputFormatters: inputFormatters,
          style: text.body.copyWith(color: colors.text.heading),
          onTapOutside: (_) => FocusManager.instance.primaryFocus?.unfocus(),
          decoration: InputDecoration(
            isDense: true,
            hintText: hint,
            hintStyle: text.body.copyWith(color: colors.text.placeholder),
            filled: true,
            fillColor: fill,
            suffixIcon: suffix,
            contentPadding: EdgeInsetsDirectional.symmetric(
              horizontal: 14.w,
              vertical: 14.h,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14.r),
              borderSide: BorderSide(color: accent),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14.r),
              borderSide: BorderSide(
                color: isNeutral ? colors.secondary.main : accent,
              ),
            ),
          ),
        ),
        if (helperText != null && helperText!.isNotEmpty) ...[
          Gap(4.h),
          Padding(
            padding: EdgeInsetsDirectional.only(start: 2.w),
            child: Text(
              helperText!,
              style: text.bodySmall.regular().copyWith(
                    color: status == MasrafyFieldStatus.error
                        ? colors.error.main
                        : colors.success.main,
                  ),
            ),
          ),
        ],
      ],
    );
  }
}
