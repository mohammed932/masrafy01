import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/result/failure.dart';
import 'package:app/core/utils/api_handler.dart';
import 'package:app/features/auth/domain/entities/customer_entity.dart';
import 'package:app/features/auth/domain/repositories/auth_repository.dart';
import 'package:app/features/auth/data/models/request/login/login_request.dart';
import 'package:app/features/auth/data/models/request/login/logout_request.dart';
import 'package:app/features/auth/data/models/request/signup/signup_request.dart';

/// Thin network-mapping forwarder for [AuthRepository] (Constitution
/// Principles X + XXX). Every call routes through [ApiHandler.callApi] and
/// maps the wire `Model` to its domain entity. Secure-storage side effects
/// live in [AuthUseCase], not here, so the repo stays a pure forwarder.
@Injectable(as: AuthRepository)
class AuthRepositoryImpl extends AuthRepository {
  AuthRepositoryImpl(super.remoteDataSource);

  @override
  Future<Either<Failure, CustomerSessionEntity>> login(LoginRequest request) async {
    final result = await ApiHandler.callApi(() => remoteDataSource.login(request));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, CustomerSessionEntity>> signup(SignupRequest request) async {
    final result = await ApiHandler.callApi(() => remoteDataSource.signup(request));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, CustomerEntity>> me() async {
    final result = await ApiHandler.callApi(() => remoteDataSource.me());
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, Unit>> logout(LogoutRequest request) async {
    // Best-effort remote revoke; local clear in the usecase is authoritative.
    try {
      await remoteDataSource.logout(request);
    } catch (_) {/* swallow */}
    return const Right(unit);
  }
}
