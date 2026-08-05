import 'package:dartz/dartz.dart';

import 'package:app/core/architecture/base_repository.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/questionnaire/data/datasources/questionnaire_remote_datasource.dart';
import 'package:app/features/questionnaire/domain/entities/questionnaire_snapshot_entity.dart';
import 'package:app/features/questionnaire/domain/enums/loan_category.dart';

/// Fetches the active published questionnaire snapshot for one loan category —
/// the pool stays GLOBAL (one list, one version) and the category selects which
/// of its questions are asked (Principle X — repository owns the datasource).
/// Returns `Either<Failure, T>`; never throws.
abstract class QuestionnaireRepository
    extends BaseRepository<QuestionnaireRemoteDataSource> {
  QuestionnaireRepository(super.remoteDataSource);

  Future<Either<Failure, QuestionnaireSnapshotEntity>> getActive(
    LoanCategory category,
  );
}
