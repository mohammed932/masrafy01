import 'package:dartz/dartz.dart';

import 'package:app/core/architecture/base_repository.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/questionnaire/data/datasources/questionnaire_remote_datasource.dart';
import 'package:app/features/questionnaire/domain/entities/questionnaire_snapshot_entity.dart';
import 'package:app/features/questionnaire/domain/enums/loan_category.dart';

/// Fetches the active published questionnaire snapshot for a loan category
/// (Principle X — repository owns the datasource). Returns `Either<Failure, T>`;
/// never throws.
abstract class QuestionnaireRepository
    extends BaseRepository<QuestionnaireRemoteDataSource> {
  QuestionnaireRepository(super.remoteDataSource);

  Future<Either<Failure, QuestionnaireSnapshotEntity>> getByCategory(
    LoanCategory category,
  );
}
