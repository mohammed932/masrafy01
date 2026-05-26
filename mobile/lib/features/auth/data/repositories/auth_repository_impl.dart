import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';

import '../../../../core/result/failure.dart';
import '../../../../core/storage/customer_session_storage.dart';
import '../../domain/entities/customer_entity.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_datasource.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._remote, this._session);

  final AuthRemoteDatasource _remote;
  final CustomerSessionStorage _session;

  @override
  Future<Either<Failure, CustomerSessionEntity>> login({
    required String phone,
    required String password,
  }) async {
    try {
      final envelope =
          await _remote.login(phone: phone, password: password);
      await _session.save(
        accessToken: envelope.accessToken,
        refreshToken: envelope.refreshToken,
        customerId: envelope.customer.id,
      );
      return Right(envelope.toEntity());
    } on DioException catch (e) {
      return Left(failureFromDio(e));
    } catch (_) {
      return const Left(UnknownFailure());
    }
  }

  @override
  Future<Either<Failure, CustomerSessionEntity>> signup({
    required String phone,
    required String name,
    required String password,
    String? email,
    String? locale,
  }) async {
    try {
      final envelope = await _remote.signup(
        phone: phone,
        name: name,
        password: password,
        email: email,
        locale: locale,
      );
      await _session.save(
        accessToken: envelope.accessToken,
        refreshToken: envelope.refreshToken,
        customerId: envelope.customer.id,
      );
      return Right(envelope.toEntity());
    } on DioException catch (e) {
      return Left(failureFromDio(e));
    } catch (_) {
      return const Left(UnknownFailure());
    }
  }

  @override
  Future<Either<Failure, CustomerEntity>> me() async {
    try {
      final model = await _remote.me();
      return Right(model.toEntity());
    } on DioException catch (e) {
      return Left(failureFromDio(e));
    } catch (_) {
      return const Left(UnknownFailure());
    }
  }

  @override
  Future<Either<Failure, Unit>> logout() async {
    try {
      final refresh = await _session.readRefreshToken();
      await _remote.logout(refreshToken: refresh);
    } on DioException {
      // Logout is best-effort; clear local state anyway.
    } catch (_) {
      // Swallow — local clear is the contract that matters.
    }
    await _session.clear();
    return const Right(unit);
  }
}
