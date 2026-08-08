import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/input_controls/masrafy_field_metrics.dart';

/// Validation tint for a [MasrafyLabeledField]: red when in error, otherwise
/// the neutral grey chrome. `valid` is signalled by the status dot + helper
/// line only — a filled field keeps the same border and fill as an empty one,
/// so a long form does not turn into a wall of coloured boxes.
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

  Color _accent(MasrafyColorTheme colors) => status == MasrafyFieldStatus.error
      ? colors.error.main
      : colors.border.main;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final accent = _accent(colors);
    final isError = status == MasrafyFieldStatus.error;
    final inputStyle = text.body.copyWith(color: colors.text.heading);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            if (showStatusDot) ...[
              // Grey until the field has something to judge — a green dot over
              // an empty required field claims a validity it can't know. Kept
              // in the layout (not hidden) so the label doesn't shift on type.
              Container(
                width: 6.r,
                height: 6.r,
                decoration: BoxDecoration(
                  color: switch (status) {
                    MasrafyFieldStatus.error => colors.error.main,
                    MasrafyFieldStatus.valid => colors.success.main,
                    MasrafyFieldStatus.neutral => colors.text.quaternary,
                  },
                  borderRadius: BorderRadius.circular(2.r),
                ),
              ),
              Gap(6.w),
            ],
            Expanded(
              child: Text(
                label.toUpperCase(),
                style: text.caption.semiBold().copyWith(
                      color: colors.primary.main,
                      letterSpacing: 0.66,
                    ),
              ),
            ),
          ],
        ),
        Gap(MasrafyFieldMetrics.labelGap),
        TextField(
          controller: controller,
          onChanged: onChanged,
          obscureText: obscure,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          inputFormatters: inputFormatters,
          style: inputStyle,
          textAlignVertical: TextAlignVertical.center,
          onTapOutside: (_) => FocusManager.instance.primaryFocus?.unfocus(),
          decoration: InputDecoration(
            isDense: true,
            hintText: hint,
            hintStyle: inputStyle.copyWith(color: colors.text.tertiary),
            // Transparent box — the 1px border carries the field, so inputs,
            // selects and the phone row read as one outlined family.
            filled: false,
            suffixIcon: suffix,
            // Caps the suffix (a 48² IconButton by default) so it cannot
            // inflate the box past [MasrafyFieldMetrics.height].
            suffixIconConstraints: BoxConstraints(
              minWidth: 40.w,
              maxHeight: MasrafyFieldMetrics.height - 2,
            ),
            // Padding, not a SizedBox, sets the height — see
            // [MasrafyFieldMetrics.verticalPaddingFor].
            contentPadding: EdgeInsetsDirectional.symmetric(
              horizontal: MasrafyFieldMetrics.horizontalPadding,
              vertical: MasrafyFieldMetrics.verticalPaddingFor(inputStyle),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(MasrafyFieldMetrics.radius),
              borderSide: BorderSide(color: accent),
            ),
            // Same 1px width as the resting border: a thicker focus ring would
            // grow the field by 1px and jitter the whole form on every focus.
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(MasrafyFieldMetrics.radius),
              borderSide: BorderSide(
                color: isError ? accent : colors.secondary.main,
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
