import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/features/onboarding/presentation/models/onboarding_slide_data.dart';

/// A single onboarding slide: hero illustration over a soft brand blob, then
/// the indigo title and muted body (Figma `71:256`). Flow-local widget per
/// Principle XXXII; one widget per file per XXXVI.
class OnboardingSlide extends StatelessWidget {
  const OnboardingSlide({super.key, required this.data});

  final OnboardingSlideData data;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return Padding(
      padding: EdgeInsetsDirectional.symmetric(horizontal: 24.w),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            height: 300.h,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Soft decorative brand blob behind the illustration.
                Container(
                  width: 260.r,
                  height: 260.r,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        colors.secondary.border.withValues(alpha: 0.35),
                        colors.secondary.border.withValues(alpha: 0.0),
                      ],
                    ),
                  ),
                ),
                Image.asset(
                  data.image,
                  fit: BoxFit.contain,
                  filterQuality: FilterQuality.medium,
                ),
              ],
            ),
          ),
          Gap(40.h),
          Text(
            data.title,
            textAlign: TextAlign.center,
            style: text.heading3.semiBold().copyWith(
                  color: colors.primary.active,
                  height: 1.3,
                ),
          ),
          Gap(16.h),
          Text(
            data.body,
            textAlign: TextAlign.center,
            style: text.bodyLarge.copyWith(
              color: colors.text.secondary,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}
