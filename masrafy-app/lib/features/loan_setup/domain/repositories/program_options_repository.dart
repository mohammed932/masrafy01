import 'package:dartz/dartz.dart';

import 'package:app/core/architecture/base_repository.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/loan_setup/data/datasources/program_options_remote_datasource.dart';
import 'package:app/features/loan_setup/domain/entities/program_options_entity.dart';
import 'package:app/features/questionnaire/domain/enums/loan_category.dart';

/// Reads the pickable income bases + catalog names for one loan category.
/// Returns `Either<Failure, T>`; never throws (Principle XXX).
abstract class ProgramOptionsRepository
    extends BaseRepository<ProgramOptionsRemoteDataSource> {
  ProgramOptionsRepository(super.remoteDataSource);

  Future<Either<Failure, ProgramOptionsEntity>> forCategory(
    LoanCategory category,
  );
}
