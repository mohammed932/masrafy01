import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/result/failure.dart';
import '../../../../core/utils/api_handler.dart';
import '../../domain/entities/apply_result_entity.dart';
import '../../domain/repositories/wizard_repository.dart';
import '../models/request/loan_application_request.dart';

/// Pilot100 shape — thin forwarder. `ApiHandler.callApi(...)` handles
/// the error surface; `.map((model) => model.toEntity())` converts the
/// wire-format DTO into the domain entity before crossing the layer.
@Injectable(as: WizardRepository)
class WizardRepositoryImpl extends WizardRepository {
  WizardRepositoryImpl(super.remoteDataSource);

  @override
  Future<Either<Failure, ApplyResultEntity>> submitLoanApplication(LoanApplicationRequest request) async {
    final result = await ApiHandler.callApi(() => remoteDataSource.submitLoanApplication(request));
    return result.map((model) => model.toEntity());
  }
}
