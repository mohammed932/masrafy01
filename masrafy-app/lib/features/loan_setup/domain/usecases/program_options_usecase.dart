import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/architecture/base_usecase.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/loan_setup/domain/entities/program_options_entity.dart';
import 'package:app/features/loan_setup/domain/repositories/program_options_repository.dart';
import 'package:app/features/questionnaire/domain/enums/loan_category.dart';

/// Fetches the pickable income bases + catalog names for one loan category.
/// Pure passthrough — orchestration lives on the cubit (Principle XXXI).
@injectable
class ProgramOptionsUseCase extends BaseUseCase<ProgramOptionsRepository> {
  ProgramOptionsUseCase(super.repository);

  Future<Either<Failure, ProgramOptionsEntity>> forCategory(
    LoanCategory category,
  ) =>
      repository.forCategory(category);
}
