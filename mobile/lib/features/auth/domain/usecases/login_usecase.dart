import 'package:dartz/dartz.dart';

import '../../../../core/result/failure.dart';
import '../entities/customer_entity.dart';
import '../repositories/auth_repository.dart';

class LoginUsecase {
  LoginUsecase(this._repository);

  final AuthRepository _repository;

  Future<Either<Failure, CustomerSessionEntity>> call({
    required String phone,
    required String password,
  }) {
    return _repository.login(phone: phone, password: password);
  }
}
