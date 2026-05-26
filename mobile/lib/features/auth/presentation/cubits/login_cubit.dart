import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../data/models/request/login/login_request.dart';
import '../../domain/entities/customer_entity.dart';
import '../../domain/repositories/auth_repository.dart';

/// Phone+password login (feature 008 / FR-021). Routes through the legacy
/// `AuthRepository` whose `login()` already targets `/api/v1/auth/login` —
/// the backend now applies the FR-022 lockout server-side (Redis counter)
/// so the cubit needs no new client-side logic. SOCIAL customers using
/// this endpoint receive `CUSTOMER_INVALID_CREDENTIALS` per FR-023.
abstract class LoginState extends Equatable {
  const LoginState();
  @override
  List<Object?> get props => [];
}

class LoginIdle extends LoginState {
  const LoginIdle();
}

class LoginInProgress extends LoginState {
  const LoginInProgress();
}

class LoginSuccess extends LoginState {
  const LoginSuccess(this.session);
  final CustomerSessionEntity session;
  @override
  List<Object?> get props => [session];
}

class LoginFailure extends LoginState {
  const LoginFailure(this.error);
  final Object error;
  @override
  List<Object?> get props => [error];
}

class LoginCubit extends Cubit<LoginState> {
  LoginCubit(this._repo) : super(const LoginIdle());
  final AuthRepository _repo;

  Future<void> submit({required String phone, required String password}) async {
    emit(const LoginInProgress());
    final res = await _repo.login(LoginRequest(phone: phone, password: password));
    res.fold(
      (err) => emit(LoginFailure(err)),
      (session) => emit(LoginSuccess(session)),
    );
  }

  void reset() => emit(const LoginIdle());
}
