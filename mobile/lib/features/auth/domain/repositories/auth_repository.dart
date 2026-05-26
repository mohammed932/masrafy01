import 'package:dartz/dartz.dart';

import '../../../../core/architecture/base_repository.dart';
import '../../../../core/result/failure.dart';
import '../../data/datasources/auth_remote_datasource.dart';
import '../../data/models/request/login/login_request.dart';
import '../../data/models/request/login/logout_request.dart';
import '../../data/models/request/signup/signup_request.dart';
import '../entities/customer_entity.dart';

/// Constitution Principles XXX + XI — extends `BaseRepository<AuthRemoteDataSource>`,
/// methods take typed `*Request` DTOs (never loose maps).
abstract class AuthRepository extends BaseRepository<AuthRemoteDataSource> {
  AuthRepository(super.remoteDataSource);

  Future<Either<Failure, CustomerSessionEntity>> login(LoginRequest request);

  Future<Either<Failure, CustomerSessionEntity>> signup(SignupRequest request);

  Future<Either<Failure, CustomerEntity>> me();

  Future<Either<Failure, Unit>> logout(LogoutRequest request);
}
