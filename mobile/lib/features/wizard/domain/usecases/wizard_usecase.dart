import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/architecture/base_usecase.dart';
import '../../../../core/result/failure.dart';
import '../../data/models/request/loan_application_request.dart';
import '../entities/apply_result_entity.dart';
import '../repositories/wizard_repository.dart';

/// Constitution Principle XXX — one usecase per feature. The wizard
/// surface today exposes a single action (submit-apply); future wizard
/// actions (save-progress, resume-draft) land as new methods here, never
/// as new `<Action>Usecase` classes.
@injectable
class WizardUseCase extends BaseUseCase<WizardRepository> {
  WizardUseCase(super.repository);

  Future<Either<Failure, ApplyResultEntity>> submitLoanApplication(LoanApplicationRequest request) =>
      repository.submitLoanApplication(request);
}
