import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/auth/data/models/request/login/login_request.dart';
import 'package:app/features/auth/domain/entities/customer_entity.dart';
import 'package:app/features/auth/domain/usecases/auth_usecase.dart';

part 'login_cubit.freezed.dart';
part 'login_state.dart';

/// Email + password login (Figma `77:1032`). Routes through
/// [AuthUseCase] so the customer-JWT tokens are persisted to
/// `flutter_secure_storage` on success (Principle XXVIII). The backend
/// applies the FR-022 lockout server-side, so no client lockout logic.
@injectable
class LoginCubit extends Cubit<LoginState> {
  LoginCubit(this._auth) : super(const LoginState());

  final AuthUseCase _auth;

  void updateField(LoginField field, Object value) {
    switch (field) {
      case LoginField.identifier:
        emit(state.copyWith(identifier: value as String, error: null));
        break;
      case LoginField.password:
        emit(state.copyWith(password: value as String, error: null));
        break;
    }
  }

  void toggleObscure() => emit(state.copyWith(obscure: !state.obscure));

  Future<void> submit() async {
    if (!state.canSubmit) return;
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _auth.login(
      LoginRequest(email: state.identifier.trim(), password: state.password),
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
