import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:intl/intl.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../../../models/match_results_args.dart';

/// A single match card in the offers list (Figma best-match `2040:1304`,
/// regular `2040:1332`). Leads with the BANK and the program it matched — the
/// same two lines `UnavailableProgramCard` leads with, so a priced and an
/// unpriced bank read alike in one list. The top pick is azure-outlined with a
/// solid CTA; the rest are white with a muted KPI row and an outlined CTA.
/// Flow-local (Principle XXXII); UI-only.
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
    final topPick = offer.isTopPick;

    // Top pick: azure-tinted fill + azure border; the rest: white + hairline.
    final cardColor = topPick
        ? colors.secondary.border.withValues(alpha: 0.2)
        : colors.bg.container;
    final cardBorder = topPick ? colors.secondary.main : colors.border.secondary;
    // KPI cells: near-white on the top pick, layout grey on the rest.
    final cellColor = topPick ? colors.bg.container : colors.bg.layout;
    // Monthly/Total values read muted on the rest, solid on the top pick.
    final valueColor = topPick ? colors.textBase : colors.primary.border;

    // The bank, then what it matched. This card compares twenty banks and had
    // never said which bank any one of them was.
    final subline = offer.programFriendlyName.isNotEmpty
        ? '${offer.programFriendlyName} · $productLabel · '
            '${l.results_months(offer.termMonths)}'
        : '$productLabel · ${l.results_months(offer.termMonths)}';

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
          if (offer.bankName.isNotEmpty) ...[
            Text(
              offer.bankName,
              style: text.heading4.copyWith(color: colors.textBase),
            ),
            Gap(2.h),
          ],
          Text(
            subline,
            style: text.bodySmall.copyWith(color: colors.text.secondary),
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
          if (offer.maxLoan != null) ...[
            Gap(8.h),
            _MaxBorrowBand(
              label: l.results_max_borrow,
              value: l.results_max_borrow_value(
                NumberFormat.decimalPattern().format(offer.maxLoan),
              ),
              emphasised: offer.hasUnusedHeadroom,
            ),
          ],
          // A no-payslip offer's figures come from the unit, and nothing else on this card
          // says so — the max-borrow band above reads as "what your salary supports" to a
          // customer who never gave us one.
          if (offer.collateralCeiling != null) ...[
            Gap(6.h),
            Text(
              l.offer_collateral_ceiling(
                NumberFormat.decimalPattern().format(offer.collateralCeiling),
              ),
              style: text.caption.copyWith(
                color: colors.primary.border,
                fontSize: 10.sp,
              ),
            ),
          ],
          // What the customer puts in, and what stopped the amount going higher. Two lines
          // that answer the question a cut offer always raises — "why this much?" — which
          // the card could not answer at all before: on an auto loan the difference between
          // "borrow less" and "put more down" is the whole decision.
          if (offer.requiredDownPayment != null) ...[
            Gap(6.h),
            Text(
              l.offer_required_down_payment(
                NumberFormat.decimalPattern().format(offer.requiredDownPayment),
              ),
              style: text.caption.copyWith(
                color: colors.primary.border,
                fontSize: 10.sp,
              ),
            ),
          ],
          if (_limitedByLabel(l, offer.bindingConstraint) case final String limit) ...[
            Gap(4.h),
            Text(
              limit,
              style: text.caption.copyWith(
                color: colors.primary.border,
                fontSize: 10.sp,
              ),
            ),
          ],
          Gap(12.h),
          _ViewOfferButton(
            label: l.results_view_offer,
            topPick: topPick,
            onTap: onViewOffer,
          ),
        ],
      ),
    );
  }

  /// Why the amount stopped where it did, in the customer's words.
  ///
  /// Only the ceilings that CUT the amount get a line. `requested_amount` means nothing was
  /// cut, a term constraint already shows as the term, and an unknown code prints nothing —
  /// never the raw token, which is untranslated English to an Arabic-first reader.
  static String? _limitedByLabel(AppLocalizations l, String? constraint) => switch (constraint) {
        'ltv_ceiling' => l.offer_limited_by_ltv,
        'dbr_affordability' => l.offer_limited_by_dbr,
        'program_max' => l.offer_limited_by_program_max,
        'program_max_by_fact' => l.offer_limited_by_program_row,
        'collateral_ceiling' => l.offer_limited_by_collateral,
        _ => null,
      };

  /// 9.5 → "9.5", 10.0 → "10".
  static String _trimRate(double rate) =>
      rate == rate.truncateToDouble() ? rate.truncate().toString() : rate.toString();
}

/// Full-width affordability line under the KPI row: the ceiling this salary
/// supports at this program. Deliberately its own band rather than a fourth KPI
/// cell — the number runs to seven digits and would be unreadable at cell width.
/// Tinted when the customer asked for less than they qualify for, which is the
/// one case nothing else on the card reveals.
class _MaxBorrowBand extends StatelessWidget {
  const _MaxBorrowBand({
    required this.label,
    required this.value,
    required this.emphasised,
  });

  final String label;
  final String value;
  final bool emphasised;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final accent = emphasised ? colors.success.main : colors.primary.border;

    return Container(
      width: double.infinity,
      padding: EdgeInsetsDirectional.symmetric(horizontal: 10.w, vertical: 8.h),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10.r),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: text.caption.copyWith(
                color: colors.primary.border,
                fontSize: 10.sp,
              ),
            ),
          ),
          Gap(8.w),
          Text(
            value,
            style: text.bodySmall.copyWith(
              color: accent,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
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
    required this.topPick,
    required this.onTap,
  });

  final String label;
  final bool topPick;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return Material(
      color: topPick ? colors.secondary.main : colors.bg.container,
      borderRadius: BorderRadius.circular(12.r),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12.r),
        child: Container(
          width: double.infinity,
          padding: EdgeInsets.symmetric(vertical: 12.h),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12.r),
            border: topPick
                ? null
                : Border.all(color: colors.secondary.border),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: text.bodySmall.copyWith(
              color: topPick ? colors.white : colors.textBase,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
