import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// One label/value line in the [MatchSummaryCard].
typedef MatchSummaryRow = ({String label, String value});

/// Loan-summary card shared by the offers-list and offer-details screens
/// (Figma `2040:1288` / `2040:1431`): a soft azure-tinted card with stacked
/// label↔value rows divided by hairlines. Feature-shared (Principle XXXIII) —
/// both flows under `offers/` render it. UI-only; callers pass localized rows.
class MatchSummaryCard extends StatelessWidget {
  const MatchSummaryCard({super.key, required this.rows});

  final List<MatchSummaryRow> rows;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(15.r),
      decoration: BoxDecoration(
        color: colors.secondary.bg,
        borderRadius: BorderRadius.circular(14.r),
        border: Border.all(color: colors.secondary.border),
      ),
      child: Column(
        children: [
          for (int i = 0; i < rows.length; i++)
            Container(
              padding: EdgeInsetsDirectional.only(top: 5.h, bottom: 6.h),
              decoration: i == rows.length - 1
                  ? null
                  : BoxDecoration(
                      border: Border(
                        bottom: BorderSide(color: colors.border.secondary),
                      ),
                    ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    rows[i].label,
                    style: text.bodySmall.semiBold().copyWith(
                          color: colors.primary.border,
                        ),
                  ),
                  Text(
                    rows[i].value,
                    style: text.bodySmall.copyWith(
                      color: colors.textBase,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
