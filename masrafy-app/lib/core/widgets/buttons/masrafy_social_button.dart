import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// Outlined social-provider button (Google) used on the login screen
/// and the final onboarding slide. Shared per Principle XXXIII.
///
/// Surface, border, shadow and label colours are tokens (Principle VIII); the
/// provider mark is a vector brand asset rendered at its own colours — it is
/// never tinted. The surface is `bg.elevated` so the button lifts off the page
/// in both themes (white on the light container, Midnight Navy `#0A1A3A` on
/// the dark one) — both are surfaces Google sanctions behind the colour "G".
///
/// Sized to sit as a peer of [MasrafyGradientButton] directly above it: same
/// 54h height, same 15r radius, same 16sp semi-bold label — only the weight of
/// the surface separates the secondary action from the primary CTA.
class MasrafySocialButton extends StatelessWidget {
  const MasrafySocialButton({
    super.key,
    required this.iconAsset,
    required this.label,
    required this.onTap,
    this.isLoading = false,
    this.height = 54,
  });

  /// Path of the provider's SVG mark (e.g. `MasrafyAssets.kSocialGoogle`).
  final String iconAsset;
  final String label;
  final VoidCallback? onTap;
  final bool isLoading;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final radius = BorderRadius.circular(15.r);
    final enabled = onTap != null && !isLoading;
    final isLight = colors.brightness == Brightness.light;

    return AnimatedOpacity(
      duration: const Duration(milliseconds: 150),
      opacity: enabled ? 1 : 0.6,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.bg.elevated,
          borderRadius: radius,
          // `border.field` (the control-outline tone) rather than the softer
          // divider tone: on the white login container a divider-weight edge
          // is the only thing carrying the button's box, and it disappears.
          border: Border.all(color: colors.border.field),
          boxShadow: [
            // Soft neutral lift so the secondary action reads as a raised
            // surface without competing with the CTA's azure glow. Skipped on
            // dark, where the elevated surface already does the lifting and a
            // near-white heading tone would cast a glow instead of a shadow.
            if (isLight)
              BoxShadow(
                color: colors.bg.solid.withValues(alpha: 0.06),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: radius,
            splashColor: colors.secondary.main.withValues(alpha: 0.08),
            highlightColor: colors.secondary.main.withValues(alpha: 0.04),
            onTap: enabled ? onTap : null,
            child: SizedBox(
              height: height.h,
              width: double.infinity,
              child: Center(
                child: isLoading
                    ? SizedBox(
                        width: 20.r,
                        height: 20.r,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: colors.secondary.main,
                        ),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SvgPicture.asset(
                            iconAsset,
                            width: 22.r,
                            height: 22.r,
                          ),
                          Gap(12.w),
                          Text(
                            label,
                            style: text.bodyLarge.semiBold().copyWith(
                                  color: colors.text.heading,
                                  fontSize: 16.sp,
                                ),
                          ),
                        ],
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
