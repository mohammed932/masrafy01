import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// One fee/charge line in the [OfferFeesCard]; [valueColor] carries the accent
/// (amber for a cost, green for a perk).
typedef OfferFeeRow = ({String label, String value, Color valueColor});

/// "Fees & charges" table on the offer-details screen (Figma `2040:1501`): a
/// bordered card of white rows split by hairlines, label↔value per row.
/// Flow-local (Principle XXXII); UI-only.
class OfferFeesCard extends StatelessWidget {
  const OfferFeesCard({super.key, required this.rows});

  final List<OfferFeeRow> rows;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return Container(
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14.r),
        border: Border.all(color: colors.border.secondary),
      ),
      child: Column(
        children: [
          for (int i = 0; i < rows.length; i++)
            Container(
              padding:
                  EdgeInsetsDirectional.symmetric(horizontal: 14.w, vertical: 11.h),
              decoration: BoxDecoration(
                color: colors.bg.container,
                border: i == rows.length - 1
                    ? null
                    : Border(
                        bottom: BorderSide(color: colors.border.secondary),
                      ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      rows[i].label,
                      style: text.bodySmall.copyWith(
                        color: colors.text.secondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  SizedBox(width: 12.w),
                  Text(
                    rows[i].value,
                    style: text.bodySmall.copyWith(
                      color: rows[i].valueColor,
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
