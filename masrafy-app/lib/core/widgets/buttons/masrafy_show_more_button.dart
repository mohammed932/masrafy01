import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/utils/masrafy_assets.dart';

/// Pixel-perfect implementation of Figma node 3388:61696 — "Show more
/// Results" button (Button / Basic, Default, Size LG).
///
/// Pill-shaped, dark elevated bg, label + trailing 18px arrow-down icon.
class MasrafyShowMoreButton extends StatelessWidget {
  const MasrafyShowMoreButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final fg = colors.text.heading;
    final disabled = onPressed == null || isLoading;

    return SizedBox(
      // Figma controlHeightLG = 40.
      height: 40.h,
      child: Material(
        color: colors.bg.elevated,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24.r),
          side: BorderSide(color: colors.border.main),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: disabled ? null : onPressed,
          child: Padding(
            // Figma paddingInlineLG = 15.
            padding: EdgeInsets.symmetric(horizontal: 15.w),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (isLoading)
                  SizedBox(
                    width: 18.r,
                    height: 18.r,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: fg,
                    ),
                  )
                else ...[
                  Text(
                    label,
                    style: TextStyle(
                      // Figma contentFontSizeLG = 16, contentLineHeightLG = 24,
                      // fontWeight = 400.
                      fontSize: 16.sp,
                      height: 24 / 16,
                      fontWeight: FontWeight.w400,
                      color: fg,
                    ),
                  ),
                  // Figma marginXS = 8 between label and trailing icon.
                  SizedBox(width: 8.w),
                  SizedBox(
                    width: 18.r,
                    height: 18.r,
                    child: SvgPicture.asset(
                      MasrafyAssets.kArrowDown,
                      colorFilter: ColorFilter.mode(fg, BlendMode.srcIn),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
