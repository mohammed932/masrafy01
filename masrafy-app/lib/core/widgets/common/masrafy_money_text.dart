import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../l10n/generated/app_localizations.dart';

/// A money amount with the EGP suffix.
///
/// EGP-only by construction: the platform lends in one currency, so there is no
/// currency to pass in and no symbol table to pick from. The suffix comes from
/// the locale catalog (`match_amount_egp`), not a hardcoded string.
class MasrafyMoneyText extends StatelessWidget {
  final num amount;
  final TextStyle? style;
  final bool strikethrough;

  const MasrafyMoneyText({
    super.key,
    required this.amount,
    this.style,
    this.strikethrough = false,
  });

  @override
  Widget build(BuildContext context) {
    final grouped = NumberFormat.decimalPattern().format(
      amount == amount.truncate() ? amount.truncate() : amount,
    );
    final formatted = AppLocalizations.of(context).match_amount_egp(grouped);

    final effectiveStyle = style ?? DefaultTextStyle.of(context).style;
    final decoration =
        strikethrough ? TextDecoration.lineThrough : TextDecoration.none;

    return Text(
      formatted,
      style: effectiveStyle.copyWith(decoration: decoration),
    );
  }
}
