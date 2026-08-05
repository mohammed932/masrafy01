import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/result/failure.dart';
import 'package:app/core/utils/api_handler.dart';
import 'package:app/features/questionnaire/domain/entities/questionnaire_snapshot_entity.dart';
import 'package:app/features/questionnaire/domain/enums/loan_category.dart';
import 'package:app/features/questionnaire/domain/repositories/questionnaire_repository.dart';

@Injectable(as: QuestionnaireRepository)
class QuestionnaireRepositoryImpl extends QuestionnaireRepository {
  QuestionnaireRepositoryImpl(super.remoteDataSource);

  @override
  Future<Either<Failure, QuestionnaireSnapshotEntity>> getActive(
    LoanCategory category,
  ) async {
    final result = await ApiHandler.callApi(
      () => remoteDataSource.getActive(category),
    );
    return result.map((model) => model.toEntity());
  }
}
