import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/result/failure.dart';
import '../../../../core/utils/api_handler.dart';
import '../../domain/entities/customer_entity.dart';
import '../../domain/repositories/auth_repository.dart';
import '../models/request/login_request.dart';
import '../models/request/logout_request.dart';
import '../models/request/signup_request.dart';

/// Pilot100 shape — every method is a one-liner that delegates to the
/// datasource through `ApiHandler.callApi(...)` and maps `Model → Entity`.
/// No side effects here; session-storage save/clear lives in the
/// usecase so the repo stays a thin forwarder.
@Injectable(as: AuthRepository)
class AuthRepositoryImpl extends AuthRepository {
  AuthRepositoryImpl(super.remoteDataSource);

  @override
  Future<Either<Failure, CustomerSessionEntity>> login(LoginRequest request) async {
    final result = await ApiHandler.callApi(() => remoteDataSource.login(request));
    return result.map((model) => model.toEntity());
  }

  @override
  Future<Either<Failure, CustomerSessionEntity>> signup(SignupRequest request) async {
    final result = await ApiHandler.callApi(() => remoteDataSource.signup(request));
    return result.map((model) => model.toEntity());
  }

  @override
  Future<Either<Failure, CustomerEntity>> me() async {
    final result = await ApiHandler.callApi(() => remoteDataSource.me());
    return result.map((model) => model.toEntity());
  }

  @override
  Future<Either<Failure, Unit>> logout(LogoutRequest request) async {
    // Best-effort: swallow any remote error — local cleanup is authoritative
    // and runs in the usecase regardless.
    try {
      await remoteDataSource.logout(request);
    } catch (_) {/* swallow */}
    return const Right(unit);
  }
}
