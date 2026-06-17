import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// One read-only row inside a [ProfileInfoCard] (Figma `4028:4449`): an
/// uppercase muted label over a bold value, with an optional hairline divider
/// below. Flow-local (Principle XXXII).
class ProfileFieldRow extends StatelessWidget {
  const ProfileFieldRow({
    super.key,
    required this.label,
    required this.value,
    this.showDivider = true,
  });

  final String label;
  final String value;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: text.caption.semiBold().copyWith(
                color: colors.text.label,
                letterSpacing: 0.66,
              ),
        ),
        Gap(4.h),
        Text(
          value,
          style: text.body.bold().copyWith(color: colors.text.heading),
        ),
        if (showDivider) ...[
          Gap(14.h),
          Divider(height: 1.h, color: colors.border.secondary),
          Gap(14.h),
        ],
      ],
    );
  }
}
