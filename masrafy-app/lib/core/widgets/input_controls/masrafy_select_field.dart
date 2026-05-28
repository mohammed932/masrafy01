import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

class MasrafySelectField<T> extends StatelessWidget {
  const MasrafySelectField({
    super.key,
    required this.label,
    required this.displayValue,
    this.hint,
    this.onTap,
    this.isLoading = false,
    this.isEnabled = true,
  });

  final String label;
  final String? displayValue;
  final String? hint;
  final VoidCallback? onTap;
  final bool isLoading;
  final bool isEnabled;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return GestureDetector(
      onTap: isEnabled ? onTap : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: text.bodySmall.regular().copyWith(color: colors.text.label),
          ),
          Gap(6.h),
          Container(
            height: 40.h,
            padding: EdgeInsets.symmetric(horizontal: 12.w),
            decoration: BoxDecoration(
              color: isEnabled ? colors.bg.container : colors.fill.quaternary,
              border: Border.all(
                color: colors.border.main,
              ),
              borderRadius: BorderRadius.circular(8.r),
            ),
            child: Row(
              children: [
                Expanded(
                  child: isLoading
                      ? Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: SizedBox(
                            width: 16.r,
                            height: 16.r,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: colors.primary.main,
                            ),
                          ),
                        )
                      : Text(
                          displayValue ?? hint ?? '',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: text.body.copyWith(
                            color: displayValue != null
                                ? colors.text.heading
                                : colors.text.placeholder,
                          ),
                        ),
                ),
                Gap(8.w),
                Icon(
                  Icons.chevron_right,
                  size: 18.r,
                  color: colors.icon.main,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
