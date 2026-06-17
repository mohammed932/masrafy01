import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// Brand gradient CTA used across onboarding, login, and home (Figma: azure
/// `secondary.main` → indigo `primary.main`, 15px radius, azure glow).
/// Promoted to `core/widgets/buttons/` per Principle XXXIII (shared on
/// second use). Tokens only — no raw hex (Principle VIII).
class MasrafyGradientButton extends StatelessWidget {
  const MasrafyGradientButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.height = 54,
    this.fontSize = 16,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final double height;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final enabled = onPressed != null && !isLoading;

    return Opacity(
      opacity: enabled ? 1 : 0.6,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(15.r),
          gradient: LinearGradient(
            begin: AlignmentDirectional.topStart,
            end: AlignmentDirectional.bottomEnd,
            colors: [colors.secondary.main, colors.primary.main],
          ),
          boxShadow: [
            BoxShadow(
              color: colors.secondary.main.withValues(alpha: 0.32),
              blurRadius: 12,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(15.r),
            onTap: enabled ? onPressed : null,
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
                          color: colors.white,
                        ),
                      )
                    : Text(
                        label,
                        style: text.bodyLarge.semiBold().copyWith(
                              color: colors.white,
                              fontSize: fontSize.sp,
                            ),
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
