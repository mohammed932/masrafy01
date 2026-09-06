import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:intl/intl.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/features/saved_offers/domain/entities/saved_offer_entity.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// A single saved-offer card (Figma `4088:189`). Bank heading + program /
/// loan-type subtitle with a filled heart (tap = unsave), the Rate/Monthly/Total
/// KPI row, and a **View offer** (primary) + **Remove** (outlined) button pair.
/// Flow-local (Principle XXXII); UI-only.
class SavedOfferCard extends StatelessWidget {
  const SavedOfferCard({
    super.key,
    required this.offer,
    required this.productLabel,
    required this.onView,
    required this.onRemove,
  });

  final SavedOfferEntity offer;

  /// Localized loan-type label, e.g. "Personal".
  final String productLabel;

  final VoidCallback onView;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final l = AppLocalizations.of(context);
    // The bank, then what it matched — the same two lines the results list
    // leads with, so a saved offer reads exactly as it did when it was matched.
    final subline = offer.programFriendlyName.isNotEmpty
        ? '${offer.programFriendlyName} · $productLabel · '
            '${l.results_months(offer.termMonths)}'
        : '$productLabel · ${l.results_months(offer.termMonths)}';

    return Container(
      width: double.infinity,
      padding: EdgeInsetsDirectional.all(17.w),
      decoration: BoxDecoration(
        color: colors.bg.container,
        borderRadius: BorderRadius.circular(15.r),
        border: Border.all(color: colors.border.secondary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (offer.bankName.isNotEmpty) ...[
                      Text(
                        offer.bankName,
                        style: text.heading4.copyWith(color: colors.textBase),
                      ),
                      Gap(2.h),
                    ],
                    Text(
                      subline,
                      style:
                          text.bodySmall.copyWith(color: colors.text.secondary),
                    ),
                  ],
                ),
              ),
              Gap(8.w),
              _HeartButton(onTap: onRemove, color: colors.error.main),
            ],
          ),
          Gap(12.h),
          Row(
            children: [
              Expanded(
                child: _KpiCell(
                  label: l.results_rate,
                  value: '${_trimRate(offer.ratePct)}%',
                  valueColor: colors.secondary.main,
                ),
              ),
              Gap(8.w),
              Expanded(
                child: _KpiCell(
                  label: l.results_monthly,
                  value: NumberFormat.decimalPattern().format(offer.monthly),
                  valueColor: colors.primary.border,
                ),
              ),
              Gap(8.w),
              Expanded(
                child: _KpiCell(
                  label: l.results_total,
                  value: offer.totalLabel,
                  valueColor: colors.primary.border,
                ),
              ),
            ],
          ),
          Gap(12.h),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: _CardButton(
                  label: l.results_view_offer,
                  filled: true,
                  onTap: onView,
                ),
              ),
              Gap(8.w),
              Expanded(
                child: _CardButton(
                  label: l.saved_offers_remove,
                  filled: false,
                  onTap: onRemove,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// 9.5 → "9.5", 10.0 → "10".
  static String _trimRate(double rate) => rate == rate.truncateToDouble()
      ? rate.truncate().toString()
      : rate.toString();
}

class _HeartButton extends StatelessWidget {
  const _HeartButton({required this.onTap, required this.color});

  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Icon(Icons.favorite, size: 24.r, color: color),
    );
  }
}

class _KpiCell extends StatelessWidget {
  const _KpiCell({
    required this.label,
    required this.value,
    required this.valueColor,
  });

  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return Container(
      padding: EdgeInsetsDirectional.symmetric(horizontal: 8.w, vertical: 9.h),
      decoration: BoxDecoration(
        color: colors.bg.layout,
        borderRadius: BorderRadius.circular(10.r),
      ),
      child: Column(
        children: [
          Text(
            label,
            style: text.caption.copyWith(
              color: colors.primary.border,
              fontSize: 10.sp,
            ),
          ),
          Gap(3.h),
          Text(
            value,
            style: text.body.copyWith(
              color: valueColor,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _CardButton extends StatelessWidget {
  const _CardButton({
    required this.label,
    required this.filled,
    required this.onTap,
  });

  final String label;
  final bool filled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return Material(
      color: filled ? colors.primary.main : colors.bg.container,
      borderRadius: BorderRadius.circular(10.r),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10.r),
        child: Container(
          padding: EdgeInsets.symmetric(vertical: 12.h),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10.r),
            border: filled ? null : Border.all(color: colors.secondary.border),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: text.bodySmall.copyWith(
              color: filled ? colors.white : colors.textBase,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
