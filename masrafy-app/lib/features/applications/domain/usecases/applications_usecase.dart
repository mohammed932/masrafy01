import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/architecture/base_usecase.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/applications/domain/entities/application_summary_entity.dart';
import 'package:app/features/applications/domain/repositories/applications_repository.dart';

/// Applications usecase — forwards to the repository (no side effects).
@injectable
class ApplicationsUseCase extends BaseUseCase<ApplicationsRepository> {
  ApplicationsUseCase(super.repository);

  Future<Either<Failure, List<ApplicationSummaryEntity>>> list() =>
      repository.list();
}
