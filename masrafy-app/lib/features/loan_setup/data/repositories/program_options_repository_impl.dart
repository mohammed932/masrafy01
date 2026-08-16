import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/result/failure.dart';
import 'package:app/core/utils/api_handler.dart';
import 'package:app/features/loan_setup/domain/entities/program_options_entity.dart';
import 'package:app/features/loan_setup/domain/repositories/program_options_repository.dart';
import 'package:app/features/questionnaire/domain/enums/loan_category.dart';

@Injectable(as: ProgramOptionsRepository)
class ProgramOptionsRepositoryImpl extends ProgramOptionsRepository {
  ProgramOptionsRepositoryImpl(super.remoteDataSource);

  @override
  Future<Either<Failure, ProgramOptionsEntity>> forCategory(
    LoanCategory category,
  ) async {
    final result = await ApiHandler.callApi(
      () => remoteDataSource.forCategory(category),
    );
    return result.map((model) => model.toEntity());
  }
}
