import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// The identity line an offer card leads with — a bank tile, then a MASKED
/// bank name ("Partner bank A"), then [subline].
///
/// The real bank is never named on an offer screen: the customer applies
/// through Masrafy, and a named bank (or a program name that carries one, such
/// as "NBE AUTO LOAN") is one they can walk into directly instead. The letter
/// is the offer's place in the results list, so the card and the details
/// screen it opens call the bank the same thing; a view with no list behind it
/// (a saved offer) reads "Partner bank" with no letter.
///
/// Shared by the results cards, the not-available cards, the offer details
/// hero and the saved-offers cards (Principle XXXIII).
class MasrafyPartnerBankHeading extends StatelessWidget {
  const MasrafyPartnerBankHeading({
    super.key,
    required this.label,
    required this.subline,
    this.onTintedCard = false,
  });

  /// From [labelFor].
  final String label;

  /// Loan type and term, e.g. "Car · 84 months".
  final String subline;

  /// The card behind is already azure-tinted (the top pick), so the tile flips
  /// to white to stay visible against it.
  final bool onTintedCard;

  /// "Partner bank A" for the offer at [rank] (0-based, in results order);
  /// plain "Partner bank" when there is no rank (-1).
  static String labelFor(AppLocalizations l, int rank) => rank < 0
      ? l.offer_partner_bank_generic
      : l.offer_partner_bank(String.fromCharCode(65 + rank % 26));

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return Row(
      children: [
        Container(
          width: 40.w,
          height: 40.w,
          decoration: BoxDecoration(
            color: onTintedCard ? colors.bg.container : colors.secondary.bg,
            borderRadius: BorderRadius.circular(12.r),
          ),
          alignment: Alignment.center,
          child: Icon(
            Icons.account_balance_rounded,
            size: 20.sp,
            color: colors.secondary.main,
          ),
        ),
        Gap(12.w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: text.heading4.copyWith(color: colors.textBase),
              ),
              Gap(2.h),
              Text(
                subline,
                style: text.bodySmall.copyWith(color: colors.text.secondary),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
