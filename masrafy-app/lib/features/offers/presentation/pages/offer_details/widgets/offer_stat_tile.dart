import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// One tile in the offer-details 2×3 stat grid (Figma `2040:1455`+): an
/// uppercase label, a coloured value, and a muted caption. The [valueColor]
/// carries the semantic accent (azure rate, amber pending, green total).
/// Flow-local (Principle XXXII); UI-only.
class OfferStatTile extends StatelessWidget {
  const OfferStatTile({
    super.key,
    required this.label,
    required this.value,
    required this.caption,
    required this.valueColor,
  });

  final String label;
  final String value;
  final String caption;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return Container(
      padding: EdgeInsetsDirectional.symmetric(horizontal: 13.w, vertical: 14.h),
      decoration: BoxDecoration(
        color: colors.bg.container,
        borderRadius: BorderRadius.circular(14.r),
        border: Border.all(color: colors.border.secondary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: text.caption.copyWith(
              color: colors.primary.border,
              fontWeight: FontWeight.w700,
              fontSize: 10.sp,
              letterSpacing: 0.7,
            ),
          ),
          Gap(5.h),
          Text(
            value,
            style: text.bodyLarge.copyWith(
              color: valueColor,
              fontWeight: FontWeight.w800,
            ),
          ),
          Gap(2.h),
          Text(
            caption,
            style: text.caption.copyWith(
              color: colors.primary.border,
              fontSize: 11.sp,
            ),
          ),
        ],
      ),
    );
  }
}
