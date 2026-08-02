import 'package:flutter/services.dart';

/// Groups the integer part of a typed number in thousands as the user types —
/// `1000000` reads as `1,000,000` in the field while the value handed to the
/// app stays a plain decimal STRING (Principle I / A3): callers send
/// [unformat]'ed text to the cubit and the server.
///
/// Separators are ASCII `,` / `.` in both locales on purpose: the numeric
/// keyboard and the wire format are both ASCII, so an Arabic-Indic display
/// would have to be translated back on every keystroke.
///
/// Chain it AFTER the character filter:
/// ```dart
/// inputFormatters: const [
///   GroupedNumberInputFormatter.allowedCharacters,
///   GroupedNumberInputFormatter(),
/// ]
/// ```
class GroupedNumberInputFormatter extends TextInputFormatter {
  const GroupedNumberInputFormatter();

  /// Digits, one decimal point, and the separators this formatter re-inserts.
  static final FilteringTextInputFormatter allowedCharacters =
      FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'));

  static final RegExp _numeric = RegExp(r'^\d*\.?\d*$');
  static final RegExp _thousands = RegExp(r'(\d)(?=(\d{3})+$)');

  /// Strips the grouping separators — the form the cubit and the API take.
  static String unformat(String text) => text.replaceAll(',', '');

  /// Re-groups [text] for display, or null when it isn't a number (a second
  /// decimal point, say) and the edit should be rejected.
  static String? format(String text) {
    final cleaned = unformat(text);
    if (cleaned.isEmpty) return '';
    if (!_numeric.hasMatch(cleaned)) return null;

    final dot = cleaned.indexOf('.');
    // Grouped by string surgery rather than `int.parse` so a number longer
    // than a 64-bit int still formats instead of throwing.
    final whole = dot == -1 ? cleaned : cleaned.substring(0, dot);
    final fraction = dot == -1 ? '' : cleaned.substring(dot);
    return whole.replaceAllMapped(_thousands, (m) => '${m[1]},') + fraction;
  }

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final formatted = format(newValue.text);
    if (formatted == null) return oldValue;
    if (formatted == newValue.text) return newValue;

    // Separators shift as the number grows, so the caret is re-anchored by
    // how many DIGITS sat before it rather than by raw offset.
    final caret = newValue.selection.end.clamp(0, newValue.text.length);
    final digitsBeforeCaret = _countDigits(newValue.text.substring(0, caret));

    var offset = 0;
    var seen = 0;
    while (offset < formatted.length && seen < digitsBeforeCaret) {
      if (_isDigit(formatted.codeUnitAt(offset))) seen++;
      offset++;
    }

    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: offset),
      composing: TextRange.empty,
    );
  }

  static int _countDigits(String text) {
    var count = 0;
    for (var i = 0; i < text.length; i++) {
      if (_isDigit(text.codeUnitAt(i))) count++;
    }
    return count;
  }

  static bool _isDigit(int codeUnit) => codeUnit >= 0x30 && codeUnit <= 0x39;
}
