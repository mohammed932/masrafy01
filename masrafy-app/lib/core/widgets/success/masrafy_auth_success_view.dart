import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/utils/masrafy_assets.dart';
import 'package:app/core/widgets/buttons/masrafy_primary_button.dart';
import 'package:app/core/widgets/icons/masrafy_success_check_icon.dart';

/// Shared "operation completed" template used by every post-action
/// confirmation screen (email verified, password reset complete, etc.).
/// Layout matches the Figma success-template spec — Masrafy logo,
/// concentric check badge, title + subtitle, divider, secondary heading
/// + body, primary CTA. Each screen passes its own copy + `onPressed`.
class MasrafyAuthSuccessView extends StatelessWidget {
  const MasrafyAuthSuccessView({
    super.key,
    required this.title,
    required this.subtitle,
    required this.secondaryHeading,
    required this.secondaryBody,
    required this.ctaLabel,
    required this.onCtaPressed,
  });

  final String title;
  final String subtitle;
  final String secondaryHeading;
  final String secondaryBody;
  final String ctaLabel;
  final VoidCallback onCtaPressed;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return Scaffold(
      backgroundColor: colors.bg.container,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 48.h),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _Logo(),
              Gap(32.h),
              const Center(child: MasrafySuccessCheckIcon()),
              Gap(32.h),
              Text(
                title,
                textAlign: TextAlign.center,
                style: text.heading2
                    .semiBold()
                    .copyWith(color: colors.text.heading),
              ),
              Gap(4.h),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: text.heading5
                    .regular()
                    .copyWith(color: colors.text.description),
              ),
              Gap(32.h),
              Divider(color: colors.border.main, thickness: 1, height: 1),
              Gap(32.h),
              Text(
                secondaryHeading,
                textAlign: TextAlign.center,
                style: text.heading4
                    .bold()
                    .copyWith(color: colors.text.primary),
              ),
              Gap(8.h),
              Text(
                secondaryBody,
                textAlign: TextAlign.center,
                style: text.heading5
                    .regular()
                    .copyWith(color: colors.text.tertiary),
              ),
              Gap(32.h),
              MasrafyPrimaryButton(label: ctaLabel, onPressed: onCtaPressed),
            ],
          ),
        ),
      ),
    );
  }
}

class _Logo extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final img = Image.asset(MasrafyAssets.masrafyLogo, height: 48.h);
    if (!isDark) return Center(child: img);
    return Center(
      child: ColorFiltered(
        colorFilter: const ColorFilter.matrix([
          -1, 0, 0, 0, 255,
          0, -1, 0, 0, 255,
          0, 0, -1, 0, 255,
          0, 0, 0, 1, 0,
        ]),
        child: img,
      ),
    );
  }
}
