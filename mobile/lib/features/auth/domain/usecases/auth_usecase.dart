import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/architecture/base_usecase.dart';
import '../../../../core/result/failure.dart';
import '../../../../core/storage/customer_session_storage.dart';
import '../../data/models/request/login_request.dart';
import '../../data/models/request/logout_request.dart';
import '../../data/models/request/signup_request.dart';
import '../entities/customer_entity.dart';
import '../repositories/auth_repository.dart';

/// Constitution Principle XXX — one usecase per feature; one method per
/// action. Side effects that DON'T belong to the repository (secure-
/// storage save/clear) live here so the repo stays a thin
/// network-mapping forwarder, matching the pilot100 convention.
@injectable
class AuthUseCase extends BaseUseCase<AuthRepository> {
  AuthUseCase(super.repository, this._session);

  final CustomerSessionStorage _session;

  Future<Either<Failure, CustomerSessionEntity>> login(LoginRequest request) async {
    final result = await repository.login(request);
    await result.fold(
      (_) async {},
      (session) => _session.save(
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        customerId: session.customer.id,
      ),
    );
    return result;
  }

  Future<Either<Failure, CustomerSessionEntity>> signup(SignupRequest request) async {
    final result = await repository.signup(request);
    await result.fold(
      (_) async {},
      (session) => _session.save(
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        customerId: session.customer.id,
      ),
    );
    return result;
  }

  Future<Either<Failure, CustomerEntity>> me() => repository.me();

  Future<Either<Failure, Unit>> logout() async {
    final refresh = await _session.readRefreshToken();
    final result = await repository.logout(LogoutRequest(refreshToken: refresh));
    await _session.clear();
    return result;
  }
}
