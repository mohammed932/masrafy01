import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/utils/validators.dart';

/// Live password-strength checklist (FR-048).
/// Renders five criteria rows rebuilt on each keystroke.
class PasswordStrengthIndicator extends StatelessWidget {
  const PasswordStrengthIndicator({super.key, required this.password});

  final String password;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    final criteria = [
      (label: 'At least 8 characters', met: Validators.hasMinLength(password)),
      (label: 'Uppercase letter (A–Z)', met: Validators.hasUppercase(password)),
      (label: 'Lowercase letter (a–z)', met: Validators.hasLowercase(password)),
      (label: 'Number (0–9)', met: Validators.hasDigit(password)),
      (label: 'Special character (!@#\$…)', met: Validators.hasSpecial(password)),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: criteria
          .map((c) => Padding(
                padding: EdgeInsets.only(bottom: 4.h),
                child: Row(children: [
                  Icon(
                    c.met ? Icons.check_circle : Icons.cancel_outlined,
                    size: 16.w,
                    color: c.met ? colors.success.main : colors.text.tertiary,
                  ),
                  SizedBox(width: 8.w),
                  Text(
                    c.label,
                    style: text.bodySmall
                        .regular()
                        .copyWith(color: c.met ? colors.success.main : colors.text.tertiary),
                  ),
                ]),
              ))
          .toList(),
    );
  }
}
