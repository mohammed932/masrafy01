import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';

class PilotLoadMoreButton extends StatelessWidget {
  const PilotLoadMoreButton({
    super.key,
    required this.isLoading,
    required this.isVisible,
    required this.onPressed,
    this.label = 'Show more Results',
  });

  final bool isLoading;
  final bool isVisible;
  final VoidCallback onPressed;
  final String label;

  @override
  Widget build(BuildContext context) {
    if (!isVisible) return const SizedBox.shrink();
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    return Center(
      child: OutlinedButton(
        onPressed: isLoading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: colors.border.main),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24.r),
          ),
          padding:
              EdgeInsets.symmetric(horizontal: 24.w, vertical: 12.h),
        ),
        child: isLoading
            ? SizedBox(
                width: 18.r,
                height: 18.r,
                child: CircularProgressIndicator.adaptive(
                  strokeWidth: 2,
                  valueColor:
                      AlwaysStoppedAnimation<Color>(colors.primary.main),
                ),
              )
            : Text(
                label,
                style: texts.body.copyWith(color: colors.text.secondary),
              ),
      ),
    );
  }
}
