import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:intl/intl.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/features/matching/domain/entities/apply_result_entity.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// A bank that was checked but could not be quoted, shown with its reason.
///
/// These programs used to vanish. `quoteProgram` failing is not covered by the
/// engine's `skipEligibility`, so an applicant whose existing payments used up a
/// bank's whole allowed debt burden simply never saw that bank — which reads as
/// "this bank has nothing for me" when the truth is "your current payments use up
/// its limit", and that is something he can act on.
///
/// Deliberately quieter than [MatchOfferCard] and not tappable: there is no offer
/// behind it to open. Flow-local (Principle XXXII); UI-only.
class UnavailableProgramCard extends StatelessWidget {
  const UnavailableProgramCard({
    super.key,
    required this.program,
    required this.productLabel,
  });

  final UnavailableProgramEntity program;

  /// Localized loan-type label, e.g. "Mortgage".
  final String productLabel;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final l = AppLocalizations.of(context);
    final ceiling = program.maxAffordableAmountEGP;

    return Container(
      width: double.infinity,
      padding: EdgeInsetsDirectional.fromSTEB(17.w, 18.h, 17.w, 18.h),
      decoration: BoxDecoration(
        color: colors.bg.containerDisabled,
        borderRadius: BorderRadius.circular(18.r),
        border: Border.all(color: colors.border.secondary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.info_outline_rounded,
                size: 18.r,
                color: colors.text.tertiary,
              ),
              Gap(8.w),
              Expanded(
                child: Text(
                  l.results_unavailable_badge,
                  style: text.caption.medium().copyWith(
                        color: colors.text.tertiary,
                      ),
                ),
              ),
            ],
          ),
          Gap(10.h),
          Text(
            program.bankName,
            style: text.bodyLarge.copyWith(color: colors.text.secondary),
          ),
          Gap(2.h),
          Text(
            program.programFriendlyName.isEmpty
                ? productLabel
                : program.programFriendlyName,
            style: text.caption.regular().copyWith(color: colors.text.tertiary),
          ),
          Gap(12.h),
          Text(
            _reasonText(l, program.reason),
            style: text.body.regular().copyWith(color: colors.text.secondary),
          ),
          // The ceiling is the actionable half of the message: it turns "not
          // available" into "available, but for this much".
          if (ceiling != null) ...[
            Gap(8.h),
            Text(
              l.results_unavailable_ceiling(
                NumberFormat.decimalPattern().format(ceiling.round()),
              ),
              style: text.body.medium().copyWith(color: colors.text.primary),
            ),
          ],
        ],
      ),
    );
  }

  /// Backend reason code → localized sentence (Principle III — the API never
  /// sends prose). An unrecognised code falls back to the generic line rather
  /// than rendering a raw enum at the customer.
  String _reasonText(AppLocalizations l, String code) => switch (code) {
        'OBLIGATIONS_EXCEED_ALLOWANCE' => l.reason_obligations_exceed_allowance,
        'BELOW_PROGRAM_MIN_AMOUNT' => l.reason_below_program_min_amount,
        'NO_RECOGNISED_INCOME' => l.reason_no_recognised_income,
        'AGE_AT_MATURITY' => l.reason_age_at_maturity,
        'CURRENCY_NOT_OFFERED' => l.reason_currency_not_offered,
        'PROGRAM_MISCONFIGURED' => l.reason_program_misconfigured,
        _ => l.results_unavailable_generic,
      };
}
