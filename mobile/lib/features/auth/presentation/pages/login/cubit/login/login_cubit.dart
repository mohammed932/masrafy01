import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import '../../../../../../../core/enums/request_state.dart';
import '../../../../../../../core/result/failure.dart';
import '../../../../../data/models/request/login/login_request.dart';
import '../../../../../domain/entities/customer_entity.dart';
import '../../../../../domain/repositories/auth_repository.dart';

part 'login_cubit.freezed.dart';
part 'login_state.dart';

/// Phone+password login (feature 008 / FR-021). Routes through the legacy
/// `AuthRepository` whose `login()` already targets `/api/v1/auth/login` —
/// the backend now applies the FR-022 lockout server-side (Redis counter)
/// so the cubit needs no new client-side logic. SOCIAL customers using
/// this endpoint receive `CUSTOMER_INVALID_CREDENTIALS` per FR-023.
@injectable
class LoginCubit extends Cubit<LoginState> {
  LoginCubit(this._repo) : super(const LoginState());

  final AuthRepository _repo;

  void updateField(LoginField field, Object value) {
    switch (field) {
      case LoginField.phone:
        emit(state.copyWith(phone: value as String));
        break;
      case LoginField.password:
        emit(state.copyWith(password: value as String));
        break;
    }
  }

  Future<void> submit() async {
    if (state.status.isLoading) return;
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _repo.login(
      LoginRequest(phone: state.phone, password: state.password),
    );
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (session) => emit(state.copyWith(
        status: RequestState.loaded,
        session: session,
        error: null,
      )),
    );
  }

  void reset() => emit(const LoginState());
}
