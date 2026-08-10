import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// Selectable loan-type card (Figma `137:2929`): icon beside the title.
/// Selected state uses an azure-tinted fill + azure border. Flow-local widget
/// (Principle XXXII); one widget per file (XXXVI). Tokens only.
///
/// The card sits on the same tinted layout as the program `MasrafySelectField`
/// below it, so it carries the same raised surface: a two-stop `bg.mask` lift
/// instead of a resting hairline (`MasrafyFieldMetrics.shadowFor`). A flat
/// outlined box next to a lifted field read as two different families. The
/// stroke stays only where it carries meaning — the selected state — and the
/// lift grows with it, so selection reads as the card rising, not just tinting.
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

    final tint = colors.bg.mask;

    return InkWell(
      borderRadius: BorderRadius.circular(16.r),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        padding: EdgeInsetsDirectional.all(15.r),
        decoration: BoxDecoration(
          color: selected
              ? colors.secondary.border.withValues(alpha: 0.2)
              : colors.bg.container,
          borderRadius: BorderRadius.circular(16.r),
          border: selected
              ? Border.all(color: colors.secondary.main, width: 1.5)
              : null,
          boxShadow: [
            // Tight contact stop: with no resting stroke this is what keeps the
            // card's edge readable against the layout.
            BoxShadow(
              color: tint.withValues(alpha: 0.035),
              blurRadius: 2,
              offset: const Offset(0, 1),
            ),
            // Wide ambient stop — kept airy: a card grid tiles its shadows, so
            // the weight that reads as one lifted field reads as grime here.
            // Selection lifts it slightly, and only slightly.
            BoxShadow(
              color: tint.withValues(alpha: selected ? 0.05 : 0.04),
              blurRadius: selected ? 14 : 9,
              offset: Offset(0, selected ? 4 : 2),
            ),
            if (selected)
              BoxShadow(
                color: colors.secondary.main.withValues(alpha: 0.09),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
          ],
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
