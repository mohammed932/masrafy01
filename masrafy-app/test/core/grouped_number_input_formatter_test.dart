import 'package:app/core/utils/grouped_number_input_formatter.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const formatter = GroupedNumberInputFormatter();

  TextEditingValue typed(String text) => TextEditingValue(
        text: text,
        selection: TextSelection.collapsed(offset: text.length),
      );

  TextEditingValue apply(String from, String to) =>
      formatter.formatEditUpdate(typed(from), typed(to));

  group('format', () {
    test('groups the integer part', () {
      expect(GroupedNumberInputFormatter.format('1000000'), '1,000,000');
      expect(GroupedNumberInputFormatter.format('100'), '100');
      expect(GroupedNumberInputFormatter.format('1000'), '1,000');
    });

    test('leaves the fraction ungrouped', () {
      expect(GroupedNumberInputFormatter.format('1234567.89'), '1,234,567.89');
    });

    test('handles numbers wider than a 64-bit int', () {
      expect(
        GroupedNumberInputFormatter.format('55555555555555555555555'),
        '55,555,555,555,555,555,555,555',
      );
    });

    test('rejects a second decimal point', () {
      expect(GroupedNumberInputFormatter.format('1.2.3'), isNull);
    });
  });

  group('unformat', () {
    test('strips separators', () {
      expect(GroupedNumberInputFormatter.unformat('20,000,000'), '20000000');
      expect(GroupedNumberInputFormatter.unformat('1,000.50'), '1000.50');
    });
  });

  group('formatEditUpdate', () {
    test('regroups while typing and keeps the caret at the end', () {
      final result = apply('100', '1000');
      expect(result.text, '1,000');
      expect(result.selection.baseOffset, 5);
    });

    test('caret follows the digit it was after, not the raw offset', () {
      // Caret sits after the 4th digit of `10000` → after `0,0` in `10,000`.
      final result = formatter.formatEditUpdate(
        typed('1000'),
        const TextEditingValue(
          text: '10000',
          selection: TextSelection.collapsed(offset: 4),
        ),
      );
      expect(result.text, '10,000');
      expect(
        GroupedNumberInputFormatter.unformat(
          result.text.substring(0, result.selection.baseOffset),
        ).length,
        4,
      );
    });

    test('deleting a digit regroups back down', () {
      expect(apply('1,000', '1,00').text, '100');
    });

    test('rejects an edit that is not a number', () {
      expect(apply('1.2', '1.2.').text, '1.2');
    });

    test('passes an empty field through', () {
      expect(apply('1', '').text, '');
    });
  });
}
