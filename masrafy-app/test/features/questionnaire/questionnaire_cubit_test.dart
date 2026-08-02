import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:app/core/result/failure.dart';
import 'package:app/features/questionnaire/domain/constants/money_field_bindings.dart';
import 'package:app/features/questionnaire/domain/entities/questionnaire_snapshot_entity.dart';
import 'package:app/features/questionnaire/domain/enums/question_type.dart';
import 'package:app/features/questionnaire/domain/repositories/questionnaire_repository.dart';
import 'package:app/features/questionnaire/domain/usecases/questionnaire_usecase.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_cubit.dart';

/// Regression: `submitted` is a ONE-SHOT routing signal. When it stayed true
/// after the results push, returning to the wizard left Finish dead (the cubit
/// drops an identical state) and any step change re-fired the push.
void main() {
  QuestionEntity numeric(String code) => QuestionEntity(
        code: code,
        type: QuestionType.numeric,
        questionAr: code,
        questionEn: code,
        isRequired: true,
        displayOrder: 1,
        options: const [],
      );

  final snapshot = QuestionnaireSnapshotEntity(
    versionNumber: 3,
    groups: [
      QuestionGroupEntity(
        code: 'financing_info',
        titleAr: 'financing_info',
        titleEn: 'financing_info',
        displayOrder: 1,
        questions: [numeric(kRequestedAmountQuestion), numeric(kTenorMonthsQuestion)],
      ),
      QuestionGroupEntity(
        code: 'commitments',
        titleAr: 'commitments',
        titleEn: 'commitments',
        displayOrder: 2,
        questions: [
          numeric(kMonthlyIncomeQuestion),
          numeric(kExistingObligationsQuestion),
        ],
      ),
    ],
  );

  Future<QuestionnaireCubit> loadedCubit() async {
    final cubit = QuestionnaireCubit(_FakeUseCase(snapshot));
    await cubit.load();
    cubit.setNumber(kRequestedAmountQuestion, '500000');
    cubit.setNumber(kTenorMonthsQuestion, '60');
    cubit.setNumber(kMonthlyIncomeQuestion, '25000');
    cubit.setNumber(kExistingObligationsQuestion, '0');
    cubit.next(); // step 1 → last step
    return cubit;
  }

  test('Finish arms the submit signal', () async {
    final cubit = await loadedCubit();

    expect(cubit.state.isLastStep, isTrue);
    cubit.next();
    expect(cubit.state.submitted, isTrue);
  });

  test('Finish works again after returning from the results', () async {
    final cubit = await loadedCubit();
    cubit.next();
    cubit.submissionHandled();
    expect(cubit.state.submitted, isFalse);

    // Same press that used to emit an identical state and go nowhere.
    cubit.next();
    expect(cubit.state.submitted, isTrue);
  });

  test('stepping back after a handled submission does not re-submit', () async {
    final cubit = await loadedCubit();
    cubit.next();
    cubit.submissionHandled();

    expect(cubit.back(), isTrue);
    expect(cubit.state.submitted, isFalse);
    expect(cubit.state.stepIndex, 0);
  });
}

class _FakeUseCase implements QuestionnaireUseCase {
  _FakeUseCase(this._snapshot);

  final QuestionnaireSnapshotEntity _snapshot;

  @override
  QuestionnaireRepository get repository => throw UnimplementedError();

  @override
  Future<Either<Failure, QuestionnaireSnapshotEntity>> getActive() async =>
      Right(_snapshot);
}
