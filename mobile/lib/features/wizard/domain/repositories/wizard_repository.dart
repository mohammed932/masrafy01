import 'package:dartz/dartz.dart';

import '../../../../core/architecture/base_repository.dart';
import '../../../../core/result/failure.dart';
import '../../data/datasources/wizard_remote_datasource.dart';
import '../../data/models/request/loan_application_request.dart';
import '../entities/apply_result_entity.dart';

/// Constitution Principle XXX — repository extends `BaseRepository`
/// generic-parameterised by the feature's datasource. Methods return
/// `Future<Either<Failure, T>>` of **entities**, never models.
abstract class WizardRepository extends BaseRepository<WizardRemoteDataSource> {
  WizardRepository(super.remoteDataSource);

  Future<Either<Failure, ApplyResultEntity>> submitLoanApplication(LoanApplicationRequest request);
}
