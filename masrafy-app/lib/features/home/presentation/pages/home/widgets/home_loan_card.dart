import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// Selectable loan-type card (Figma `137:2929`): icon beside the title.
/// Selected state uses an azure-tinted fill + azure border. Flow-local widget
/// (Principle XXXII); one widget per file (XXXVI). Tokens only.
class HomeLoanCard extends StatelessWidget {
  const HomeLoanCard({
    super.key,
    required this.icon,
    required this.title,
    required this.selected,
    required this.onTap,
  });

  final String icon;
  final String title;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return InkWell(
      borderRadius: BorderRadius.circular(16.r),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: EdgeInsetsDirectional.all(15.r),
        decoration: BoxDecoration(
          color: selected
              ? colors.secondary.border.withValues(alpha: 0.2)
              : colors.bg.container,
          borderRadius: BorderRadius.circular(16.r),
          border: Border.all(
            color: selected ? colors.secondary.main : colors.border.split,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12.r),
              child: Image.asset(
                icon,
                width: 40.r,
                height: 40.r,
                fit: BoxFit.contain,
                filterQuality: FilterQuality.medium,
              ),
            ),
            Gap(10.w),
            // Expanded + wrap: the card is half the screen wide, and the
            // Arabic labels are longer than the English ones — an unbounded
            // Text here overflows instead of taking a second line.
            Expanded(
              child: Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style:
                    text.bodySmall.bold().copyWith(color: colors.text.heading),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
