import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:intl/intl.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../../../models/match_results_args.dart';

/// A single match card in the offers list (Figma best-match `2040:1304`,
/// regular `2040:1332`). The best match is azure-outlined with a "Best Match"
/// chip and a solid CTA; regular cards are white with a muted KPI row and an
/// outlined CTA. Flow-local (Principle XXXII); UI-only.
class MatchOfferCard extends StatelessWidget {
  const MatchOfferCard({
    super.key,
    required this.offer,
    required this.productLabel,
    required this.onViewOffer,
  });

  final MatchOffer offer;

  /// Localized loan-type label, e.g. "Mortgage".
  final String productLabel;

  final VoidCallback onViewOffer;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final l = AppLocalizations.of(context);
    final best = offer.isBestMatch;

    // Best-match: azure-tinted fill + azure border; regular: white + hairline.
    final cardColor =
        best ? colors.secondary.border.withValues(alpha: 0.2) : colors.bg.container;
    final cardBorder = best ? colors.secondary.main : colors.border.secondary;
    // KPI cells: near-white on the best card, layout grey on regular cards.
    final cellColor = best ? colors.bg.container : colors.bg.layout;
    // Monthly/Total values read muted on regular cards, solid on the best one.
    final valueColor = best ? colors.textBase : colors.primary.border;

    return Container(
      width: double.infinity,
      padding: EdgeInsetsDirectional.fromSTEB(17.w, 23.h, 17.w, 17.h),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(18.r),
        border: Border.all(color: cardBorder),
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
                    Text(
                      l.results_guarantee_approval(offer.approvalPct),
                      style: text.bodyLarge.copyWith(
                        color: colors.primary.main,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Gap(1.h),
                    Text(
                      '$productLabel · ${l.results_months(offer.termMonths)}',
                      style: text.bodySmall.copyWith(
                        color: colors.primary.border,
                      ),
                    ),
                  ],
                ),
              ),
              if (best) ...[
                Gap(8.w),
                _BestMatchChip(label: l.results_best_match),
              ],
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
                  background: cellColor,
                ),
              ),
              Gap(8.w),
              Expanded(
                child: _KpiCell(
                  label: l.results_monthly,
                  value: NumberFormat.decimalPattern().format(offer.monthly),
                  valueColor: valueColor,
                  background: cellColor,
                ),
              ),
              Gap(8.w),
              Expanded(
                child: _KpiCell(
                  label: l.results_total,
                  value: offer.totalLabel,
                  valueColor: valueColor,
                  background: cellColor,
                ),
              ),
            ],
          ),
          Gap(12.h),
          _ViewOfferButton(
            label: l.results_view_offer,
            best: best,
            onTap: onViewOffer,
          ),
        ],
      ),
    );
  }

  /// 9.5 → "9.5", 10.0 → "10".
  static String _trimRate(double rate) =>
      rate == rate.truncateToDouble() ? rate.truncate().toString() : rate.toString();
}

class _BestMatchChip extends StatelessWidget {
  const _BestMatchChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return Container(
      padding: EdgeInsetsDirectional.symmetric(horizontal: 11.w, vertical: 4.h),
      decoration: BoxDecoration(
        color: colors.success.main.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(999.r),
        border: Border.all(color: colors.success.border),
      ),
      child: Text(
        label,
        style: text.caption.copyWith(
          color: colors.success.main,
          fontWeight: FontWeight.w700,
          fontSize: 10.sp,
        ),
      ),
    );
  }
}

class _KpiCell extends StatelessWidget {
  const _KpiCell({
    required this.label,
    required this.value,
    required this.valueColor,
    required this.background,
  });

  final String label;
  final String value;
  final Color valueColor;
  final Color background;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return Container(
      padding: EdgeInsetsDirectional.symmetric(horizontal: 8.w, vertical: 9.h),
      decoration: BoxDecoration(
        color: background,
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

class _ViewOfferButton extends StatelessWidget {
  const _ViewOfferButton({
    required this.label,
    required this.best,
    required this.onTap,
  });

  final String label;
  final bool best;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return Material(
      color: best ? colors.secondary.main : colors.bg.container,
      borderRadius: BorderRadius.circular(12.r),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12.r),
        child: Container(
          width: double.infinity,
          padding: EdgeInsets.symmetric(vertical: 12.h),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12.r),
            border: best
                ? null
                : Border.all(color: colors.secondary.border),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: text.bodySmall.copyWith(
              color: best ? colors.white : colors.textBase,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
