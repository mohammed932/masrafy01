import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class PilotMoneyText extends StatelessWidget {
  final num amount;
  final String currency;
  final TextStyle? style;
  final bool strikethrough;

  const PilotMoneyText({
    super.key,
    required this.amount,
    required this.currency,
    this.style,
    this.strikethrough = false,
  });

  @override
  Widget build(BuildContext context) {
    final symbol = _symbol(currency);
    final formatted = NumberFormat.currency(
      symbol: symbol,
      decimalDigits: amount == amount.truncate() ? 0 : 2,
    ).format(amount);

    final effectiveStyle = style ?? DefaultTextStyle.of(context).style;
    final decoration =
        strikethrough ? TextDecoration.lineThrough : TextDecoration.none;

    return Text(
      formatted,
      style: effectiveStyle.copyWith(decoration: decoration),
    );
  }

  static String _symbol(String currency) => switch (currency.toUpperCase()) {
        'EUR' => '€',
        'USD' => '\$',
        'GBP' => '£',
        _ => currency,
      };
}
