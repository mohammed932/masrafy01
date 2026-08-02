import 'package:flutter_test/flutter_test.dart';

import 'package:app/features/questionnaire/domain/constants/money_field_bindings.dart';
import 'package:app/features/questionnaire/domain/entities/question_answer.dart';
import 'package:app/features/questionnaire/domain/entities/questionnaire_snapshot_entity.dart';
import 'package:app/features/questionnaire/domain/enums/enabled_when_operator.dart';
import 'package:app/features/questionnaire/domain/enums/question_type.dart';
import 'package:app/features/questionnaire/presentation/mappers/apply_mapping.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_cubit.dart';

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

    test('separates a bounds break from an off-step figure', () {
      // The field picks its message from these two, so a `step: 6` tenor typed
      // as 9 no longer reads "enter a value between 6 and 120".
      expect(rules.withinBounds(1500), isTrue);
      expect(rules.onStep(1500), isFalse);
      expect(rules.withinBounds(999), isFalse);
    });
  });

  group('NumericRulesEntity step neighbours', () {
    const tenor = NumericRulesEntity(
      minValue: '6.00',
      maxValue: '120.00',
      step: '6.00',
      unitEn: 'months',
      unitAr: 'شهر',
    );

    test('names the grid point either side of an off-step figure', () {
      expect(tenor.stepBelowDisplay(9), '6');
      expect(tenor.stepAboveDisplay(9), '12');
    });

    test('groups thousands the way the bounds hint does', () {
      const amount = NumericRulesEntity(
        minValue: '1000.00',
        maxValue: '20000000.00',
        step: '1000.00',
      );
      expect(amount.stepBelowDisplay(1500), '1,000');
      expect(amount.stepAboveDisplay(1500), '2,000');
    });

    test('drops a neighbour that would leave the band', () {
      // A max that is not itself on the grid: 118 snaps up to 120, past the cap.
      const capped =
          NumericRulesEntity(minValue: '6', maxValue: '119', step: '6');
      expect(capped.stepAboveDisplay(118), isNull);
      expect(capped.stepBelowDisplay(118), '114');
    });

    test('is null when the question declares no step', () {
      const free = NumericRulesEntity(minValue: '0', maxValue: '5000000');
      expect(free.stepBelowDisplay(1234), isNull);
      expect(free.stepAboveDisplay(1234), isNull);
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

  group('QuestionnaireState.steps', () {
    QuestionEntity question(String code, {QuestionEnabledWhenEntity? when}) =>
        QuestionEntity(
          code: code,
          type: QuestionType.singleSelect,
          questionAr: code,
          questionEn: code,
          isRequired: true,
          displayOrder: 1,
          enabledWhen: when,
          options: const [
            QuestionOptionEntity(
              code: 'yes',
              labelAr: 'نعم',
              labelEn: 'Yes',
              displayOrder: 1,
            ),
          ],
        );

    QuestionGroupEntity group(String code, List<QuestionEntity> questions) =>
        QuestionGroupEntity(
          code: code,
          titleAr: code,
          titleEn: code,
          displayOrder: 1,
          questions: questions,
        );

    QuestionnaireState stateOf(
      List<QuestionGroupEntity> groups, {
      Map<String, QuestionAnswer> answers = const {},
      int currentStep = 0,
    }) =>
        QuestionnaireState(
          snapshot: QuestionnaireSnapshotEntity(
            versionNumber: 1,
            groups: groups,
          ),
          answers: answers,
          currentStep: currentStep,
        );

    test('drops a group the snapshot left with no questions', () {
      // The global pool merges a question into the first group claiming its
      // code, so later groups (`credit_status`, `financial_status`) arrive
      // empty — they must not occupy a blank step.
      final state = stateOf([
        group('financing_info', [question('amount')]),
        group('credit_status', const []),
        group('preferences', [question('priority')]),
      ]);

      expect(state.steps.map((g) => g.code), ['financing_info', 'preferences']);
      expect(state.totalSteps, 2);
      expect(state.currentGroup?.code, 'financing_info');
    });

    test('drops a group whose last question is hidden by a branch rule', () {
      final groups = [
        group('a', [question('has_loan')]),
        group('b', [
          question(
            'loan_kind',
            when: const QuestionEnabledWhenEntity(
              questionCode: 'has_loan',
              operator: EnabledWhenOperator.equals,
              optionCode: 'yes',
            ),
          ),
        ]),
      ];

      expect(stateOf(groups).steps.length, 1);
      expect(
        stateOf(
          groups,
          answers: {'has_loan': const SingleChoiceAnswer('yes')},
        ).steps.length,
        2,
      );
    });

    test('clamps the cursor when the wizard shortens under it', () {
      final state = stateOf(
        [
          group('a', [question('q1')]),
          group('b', const []),
        ],
        currentStep: 1,
      );

      expect(state.stepIndex, 0);
      expect(state.isLastStep, isTrue);
      expect(state.currentGroup?.code, 'a');
    });

    test('reports no steps when every group is empty', () {
      final state = stateOf([group('a', const []), group('b', const [])]);

      expect(state.steps, isEmpty);
      expect(state.currentGroup, isNull);
      expect(state.progress, 0);
    });
  });
}
