import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/architecture/base_usecase.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/questionnaire/domain/entities/questionnaire_snapshot_entity.dart';
import 'package:app/features/questionnaire/domain/enums/loan_category.dart';
import 'package:app/features/questionnaire/domain/repositories/questionnaire_repository.dart';

/// Fetches the active questionnaire snapshot for one loan category. Pure
/// passthrough — no side effects (Principle XXXI orchestration lives on the
/// cubit).
@injectable
class QuestionnaireUseCase extends BaseUseCase<QuestionnaireRepository> {
  QuestionnaireUseCase(super.repository);

  Future<Either<Failure, QuestionnaireSnapshotEntity>> getActive(
    LoanCategory category, {
    String? programNameKey,
  }) =>
      repository.getActive(category, programNameKey: programNameKey);
}
