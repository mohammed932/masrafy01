import 'package:dartz/dartz.dart';

import '../../../../core/result/failure.dart';
import '../entities/customer_entity.dart';

abstract class AuthRepository {
  Future<Either<Failure, CustomerSessionEntity>> login({
    required String phone,
    required String password,
  });

  Future<Either<Failure, CustomerSessionEntity>> signup({
    required String phone,
    required String name,
    required String password,
    String? email,
    String? locale,
  });

  Future<Either<Failure, CustomerEntity>> me();

  Future<Either<Failure, Unit>> logout();
}
