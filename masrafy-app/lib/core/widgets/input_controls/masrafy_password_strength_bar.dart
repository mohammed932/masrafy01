import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/utils/validators.dart';

/// Four-segment password strength meter + a single remediation hint
/// (Figma sign-up `91:411`). Score 0–4 (length · case-mix · digit · special),
/// segments tinted error → warning → success. Replaces the multi-row criteria
/// checklist on dense forms where the Figma calls for the compact bar.
class MasrafyPasswordStrengthBar extends StatelessWidget {
  const MasrafyPasswordStrengthBar({super.key, required this.password});

  final String password;

  int get _score {
    if (password.isEmpty) return 0;
    var s = 0;
    if (Validators.hasMinLength(password)) s++;
    if (Validators.hasUppercase(password) && Validators.hasLowercase(password)) s++;
    if (Validators.hasDigit(password)) s++;
    if (Validators.hasSpecial(password)) s++;
    return s;
  }

  String get _hint {
    if (!Validators.hasMinLength(password)) return 'Too short — use 8+ characters';
    if (!(Validators.hasUppercase(password) && Validators.hasLowercase(password))) {
      return 'Mix uppercase and lowercase letters';
    }
    if (!Validators.hasDigit(password)) return 'Add a number';
    if (!Validators.hasSpecial(password)) return 'Add a special character (!@#…)';
    return 'Strong password';
  }

  Color _scoreColor(MasrafyColorTheme colors, int score) {
    if (score <= 1) return colors.error.main;
    if (score <= 3) return colors.warning.main;
    return colors.success.main;
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final score = _score;
    final active = _scoreColor(colors, score);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            for (var i = 0; i < 4; i++) ...[
              if (i > 0) Gap(3.w),
              Expanded(
                child: Container(
                  height: 3.h,
                  decoration: BoxDecoration(
                    color: i < score ? active : colors.border.main,
                    borderRadius: BorderRadius.circular(999.r),
                  ),
                ),
              ),
            ],
          ],
        ),
        Gap(5.h),
        Padding(
          padding: EdgeInsetsDirectional.only(start: 2.w),
          child: Text(
            _hint,
            style: text.bodySmall.regular().copyWith(
                  color: score >= 4 ? colors.success.main : active,
                ),
          ),
        ),
      ],
    );
  }
}
