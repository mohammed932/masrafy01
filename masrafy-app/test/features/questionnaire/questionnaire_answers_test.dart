import 'package:flutter_test/flutter_test.dart';

import 'package:app/features/questionnaire/domain/constants/money_field_bindings.dart';
import 'package:app/features/questionnaire/domain/entities/question_answer.dart';
import 'package:app/features/questionnaire/domain/entities/questionnaire_snapshot_entity.dart';
import 'package:app/features/questionnaire/domain/enums/enabled_when_operator.dart';
import 'package:app/features/questionnaire/presentation/mappers/apply_mapping.dart';

/// Feature 010 regressions: the four money figures must reach the engine as the
/// applicant stated them (the bucket→midpoint maps quoted a 500 000 request on
/// 300 000), each answer must serialize under exactly one wire key, and the
/// numeric bounds must be enforced the way the server enforces them.
void main() {
  Map<String, QuestionAnswer> moneyAnswers({
    String amount = '500000',
    String tenor = '60',
    String income = '25000',
    String obligations = '0',
  }) =>
      {
        kRequestedAmountQuestion: NumericAnswer(amount),
        kTenorMonthsQuestion: NumericAnswer(tenor),
        kMonthlyIncomeQuestion: NumericAnswer(income),
        kExistingObligationsQuestion: NumericAnswer(obligations),
      };

  group('MoneyFigures', () {
    test('passes the stated amount through, never a bucket midpoint', () {
      final money = MoneyFigures.fromAnswers(moneyAnswers());

      expect(money.requestedAmountEGP, '500000.00');
      expect(money.tenorMonths, 60);
      expect(money.monthlyIncomeEGP, '25000.00');
    });

    test('derives hasCurrentLoan from the stated installment figure', () {
      expect(
        MoneyFigures.fromAnswers(moneyAnswers(obligations: '0'))
            .hasCurrentLoan,
        isFalse,
      );
      expect(
        MoneyFigures.fromAnswers(moneyAnswers(obligations: '1500'))
            .hasCurrentLoan,
        isTrue,
      );
    });

    test('throws rather than defaulting when a binding is unanswered', () {
      final answers = moneyAnswers()..remove(kRequestedAmountQuestion);

      expect(
        () => MoneyFigures.fromAnswers(answers),
        throwsA(isA<StateError>()),
      );
    });

    test('clamps only the tenor, to the DTO 6–360 band', () {
      expect(MoneyFigures.fromAnswers(moneyAnswers(tenor: '3')).tenorMonths, 6);
      expect(
        MoneyFigures.fromAnswers(moneyAnswers(tenor: '600')).tenorMonths,
        360,
      );
    });
  });

  group('toSubmittedAnswers', () {
    test('emits exactly one value key per answer type', () {
      final payload = toSubmittedAnswers({
        'a': const SingleChoiceAnswer('yes'),
        'b': const MultiChoiceAnswer(['x', 'y']),
        'c': const NumericAnswer('1500'),
        'd': const TextAnswer('hello'),
      }).map((a) => a.toJson()).toList();

      expect(payload[0], {'questionCode': 'a', 'optionCode': 'yes'});
      expect(payload[1], {
        'questionCode': 'b',
        'optionCodes': ['x', 'y'],
      });
      expect(payload[2], {'questionCode': 'c', 'numericValue': '1500'});
      expect(payload[3], {'questionCode': 'd', 'textValue': 'hello'});
    });
  });

  group('NumericRulesEntity.accepts', () {
    const rules = NumericRulesEntity(
      minValue: '1000',
      maxValue: '20000000',
      step: '1000',
      unitEn: 'EGP',
      unitAr: 'جنيه',
    );

    test('is inclusive at both bounds', () {
      expect(rules.accepts(1000), isTrue);
      expect(rules.accepts(20000000), isTrue);
      expect(rules.accepts(999), isFalse);
      expect(rules.accepts(20000001), isFalse);
    });

    test('counts the step up from the minimum', () {
      expect(rules.accepts(3000), isTrue);
      expect(rules.accepts(1500), isFalse);
    });

    test('accepts anything when no rule is set', () {
      expect(const NumericRulesEntity().accepts(7.5), isTrue);
    });
  });

  group('enabledWhen', () {
    const rule = QuestionEnabledWhenEntity(
      questionCode: 'has_loan',
      operator: EnabledWhenOperator.equals,
      optionCode: 'yes',
    );

    test('a multi-pick satisfies equals when any code matches', () {
      expect(
        rule.isSatisfied({'has_loan': const MultiChoiceAnswer(['no', 'yes'])}),
        isTrue,
      );
    });

    test('an unanswered source reads as not picked', () {
      expect(rule.isSatisfied(const {}), isFalse);
    });

    test('not_equals is the inverse', () {
      const inverse = QuestionEnabledWhenEntity(
        questionCode: 'has_loan',
        operator: EnabledWhenOperator.notEquals,
        optionCode: 'yes',
      );
      expect(inverse.isSatisfied(const {}), isTrue);
      expect(
        inverse.isSatisfied({'has_loan': const SingleChoiceAnswer('yes')}),
        isFalse,
      );
    });
  });
}
