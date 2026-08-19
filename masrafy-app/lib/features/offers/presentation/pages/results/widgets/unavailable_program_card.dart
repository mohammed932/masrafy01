import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:intl/intl.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/features/matching/domain/entities/apply_result_entity.dart';
import 'package:app/features/matching/presentation/mappers/figures_unavailable_reason.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// A bank that was checked but could not be priced, WITH the reason (FR-022, FR-023).
///
/// Deliberately a card in the same list as the priced offers, not a hidden row and not
/// a filtered-out program: the engine ranks every program in the category and a bank
/// that silently disappears reads as "this bank doesn't exist for me", when the truth
/// — "we haven't asked you for a detail it needs", "your answer isn't in its table",
/// "your current payments use up its limit" — is something that can be acted on.
///
/// **No figures are shown, and none are faked.** Where the priced cards carry an
/// installment, this one carries a sentence. A `0` in that slot would tell the
/// applicant this bank offered them nothing, which is a different and false claim
/// (FR-020). The affordability ceiling is shown when the backend supplied one, because
/// that IS a real figure about a real limit.
///
/// Visually recessive on purpose — layout-grey fill, hairline border, no CTA — so the
/// priced offers above stay the focus. Flow-local (Principle XXXII); UI-only.
class UnavailableProgramCard extends StatelessWidget {
  const UnavailableProgramCard({super.key, required this.program});

  final UnavailableProgramEntity program;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final l = AppLocalizations.of(context);
    final ceiling = program.maxAffordableAmountEGP;

    return Container(
      width: double.infinity,
      padding: EdgeInsetsDirectional.fromSTEB(17.w, 17.h, 17.w, 17.h),
      decoration: BoxDecoration(
        color: colors.bg.layout,
        borderRadius: BorderRadius.circular(18.r),
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
                    Text(
                      program.bankName,
                      style: text.heading4.copyWith(color: colors.textBase),
                    ),
                    Gap(2.h),
                    Text(
                      program.programFriendlyName,
                      style: text.bodySmall.copyWith(color: colors.text.secondary),
                    ),
                  ],
                ),
              ),
              Gap(8.w),
              // A neutral badge, never an error colour: the bank has not refused
              // anything and the applicant has done nothing wrong.
              Container(
                padding: EdgeInsetsDirectional.fromSTEB(10.w, 4.h, 10.w, 4.h),
                decoration: BoxDecoration(
                  color: colors.bg.container,
                  borderRadius: BorderRadius.circular(999.r),
                  border: Border.all(color: colors.border.secondary),
                ),
                child: Text(
                  l.results_unavailable_badge,
                  style: text.caption.copyWith(color: colors.text.secondary),
                ),
              ),
            ],
          ),
          Gap(12.h),
          // Where the priced cards show money. Localized from the backend's reason
          // CODE — no English ever crosses the API (Principle III).
          Text(
            // The gate code is passed through so a refused CONDITION names itself. "A
            // condition your answers don't meet" is true and useless; "the amount you have
            // paid is below this bank's minimum" is something the customer can act on.
            figuresUnavailableLabel(
              l,
              program.reason,
              gateReasonCode: program.gateReasonCode,
            ),
            style: text.body.copyWith(color: colors.textBase),
          ),
          if (ceiling != null && ceiling > 0) ...[
            Gap(8.h),
            Text(
              l.results_unavailable_ceiling(
                NumberFormat.decimalPattern().format(ceiling),
              ),
              style: text.caption.copyWith(color: colors.text.secondary),
            ),
          ],
        ],
      ),
    );
  }
}
