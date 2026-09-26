import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/buttons/masrafy_primary_button.dart';
import 'package:app/core/widgets/cards/masrafy_card.dart';
import 'package:app/features/matching/presentation/mappers/figures_unavailable_reason.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// No bank made an offer — and here is WHY, so the applicant can change the
/// answer that stopped them and try again (FR-023).
///
/// One row per distinct reason, not per bank: "the amount you've paid is below
/// the minimum" under four masked letters is one thing to fix. Each row says how
/// many banks gave it, so the reason that blocks the most banks reads as the one
/// worth fixing first. No figures, and never a `0` (FR-020).
///
/// Shown ONLY when there is no offer at all: beside priced offers the refused
/// banks were noise. Flow-local (Principle XXXII); UI-only.
class NoOfferReasonsView extends StatelessWidget {
  const NoOfferReasonsView({
    super.key,
    required this.reasons,
    required this.onEditAnswers,
  });

  /// `MatchingResultsState.noOfferReasons` — already grouped, engine order.
  final List<({String reason, String? gateReasonCode, int bankCount})> reasons;
  final VoidCallback onEditAnswers;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final l = AppLocalizations.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: Container(
            width: 64.r,
            height: 64.r,
            decoration: BoxDecoration(
              color: colors.warning.bg,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Icon(
              Icons.search_off_rounded,
              size: 30.r,
              color: colors.warning.main,
            ),
          ),
        ),
        Gap(16.h),
        Text(
          l.results_empty_title,
          style: text.heading5.copyWith(color: colors.textBase),
          textAlign: TextAlign.center,
        ),
        Gap(8.h),
        Text(
          l.results_no_offer_body,
          style: text.body.copyWith(color: colors.text.secondary),
          textAlign: TextAlign.center,
        ),
        Gap(28.h),
        Text(
          l.results_no_offer_fix_title,
          style: text.body.semiBold().copyWith(color: colors.textBase),
        ),
        Gap(12.h),
        for (var i = 0; i < reasons.length; i++) ...[
          if (i > 0) Gap(10.h),
          _ReasonCard(reason: reasons[i]),
        ],
        Gap(24.h),
        MasrafyPrimaryButton(
          label: l.results_edit_answers,
          icon: Icon(Icons.edit_rounded, size: 16.sp, color: colors.white),
          onPressed: onEditAnswers,
          width: double.infinity,
        ),
      ],
    );
  }
}

/// One reason as its own card: an icon tile naming what kind of thing to fix,
/// the sentence in the customer's words, and a pill with how many banks it
/// stopped.
class _ReasonCard extends StatelessWidget {
  const _ReasonCard({required this.reason});

  final ({String reason, String? gateReasonCode, int bankCount}) reason;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final l = AppLocalizations.of(context);

    return MasrafyCard(
      radius: 16.r,
      borderColor: colors.border.secondary,
      padding: EdgeInsetsDirectional.fromSTEB(14.w, 14.h, 14.w, 14.h),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40.r,
            height: 40.r,
            decoration: BoxDecoration(
              color: colors.warning.bg,
              borderRadius: BorderRadius.circular(12.r),
            ),
            alignment: Alignment.center,
            child: Icon(
              _iconFor(reason.reason, reason.gateReasonCode),
              size: 20.r,
              color: colors.warning.main,
            ),
          ),
          Gap(12.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Localized from the backend's reason CODE — no English ever
                // crosses the API (Principle III). The gate code names WHICH
                // condition refused, which is the part the customer can change.
                Text(
                  figuresUnavailableLabel(
                    l,
                    reason.reason,
                    gateReasonCode: reason.gateReasonCode,
                  ),
                  style: text.body.medium().copyWith(color: colors.textBase),
                ),
                Gap(8.h),
                Container(
                  padding: EdgeInsetsDirectional.symmetric(
                    horizontal: 10.w,
                    vertical: 3.h,
                  ),
                  decoration: BoxDecoration(
                    color: colors.bg.layout,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.account_balance_rounded,
                        size: 12.sp,
                        color: colors.text.secondary,
                      ),
                      Gap(4.w),
                      Text(
                        l.loan_setup_bank_count(reason.bankCount),
                        style: text.caption
                            .copyWith(color: colors.text.secondary),
                      ),
                    ],
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

/// What KIND of thing the customer has to change, as an icon. An unknown code
/// gets the neutral one — the sentence beside it already says it generically.
IconData _iconFor(String reason, String? gateReasonCode) {
  if (reason == FiguresUnavailableReasons.productRuleGateFailed) {
    return switch (gateReasonCode) {
      GateReasonCodes.downPaymentBelowMin => Icons.savings_outlined,
      GateReasonCodes.unitPriceBelowMin => Icons.home_outlined,
      GateReasonCodes.contractTooNew ||
      GateReasonCodes.contractTooOld =>
        Icons.event_note_outlined,
      GateReasonCodes.ownershipNotConfirmed ||
      GateReasonCodes.multiUnitNotConfirmed =>
        Icons.home_work_outlined,
      GateReasonCodes.selfEmployedDocsMissing => Icons.description_outlined,
      GateReasonCodes.businessTooNew => Icons.storefront_outlined,
      GateReasonCodes.loanTooNew => Icons.schedule_rounded,
      _ => Icons.rule_rounded,
    };
  }
  return switch (reason) {
    FiguresUnavailableReasons.noRecognisedIncome => Icons.payments_outlined,
    FiguresUnavailableReasons.obligationsExceedAllowance =>
      Icons.credit_card_outlined,
    FiguresUnavailableReasons.belowProgramMinAmount =>
      Icons.trending_down_rounded,
    FiguresUnavailableReasons.requestedBelowProgramMinAmount =>
      Icons.trending_up_rounded,
    FiguresUnavailableReasons.ageAtMaturity => Icons.cake_outlined,
    FiguresUnavailableReasons.surrogateFactMissing => Icons.help_outline_rounded,
    FiguresUnavailableReasons.surrogateNoMatchingRow ||
    FiguresUnavailableReasons.noMaxLoanForAnswer =>
      Icons.table_rows_outlined,
    FiguresUnavailableReasons.noRateForAnswer => Icons.percent_rounded,
    FiguresUnavailableReasons.vehicleNotEligible =>
      Icons.directions_car_outlined,
    _ => Icons.info_outline_rounded,
  };
}
