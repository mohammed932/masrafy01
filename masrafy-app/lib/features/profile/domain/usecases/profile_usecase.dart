import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/architecture/base_usecase.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/profile/domain/entities/customer_profile_entity.dart';
import 'package:app/features/profile/domain/repositories/profile_repository.dart';

/// Profile usecase — forwards to the repository (no side effects).
@injectable
class ProfileUseCase extends BaseUseCase<ProfileRepository> {
  ProfileUseCase(super.repository);

  Future<Either<Failure, CustomerProfileEntity>> getMe() => repository.getMe();
}
