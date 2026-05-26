import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/usecases/login_usecase.dart';
import 'login_state.dart';

class LoginCubit extends Cubit<LoginState> {
  LoginCubit(this._loginUsecase) : super(const LoginState());

  final LoginUsecase _loginUsecase;

  Future<void> submit({required String phone, required String password}) async {
    if (state.status == LoginStatus.submitting) return;
    emit(state.copyWith(status: LoginStatus.submitting, clearError: true));
    final result = await _loginUsecase(phone: phone, password: password);
    result.fold(
      (failure) => emit(state.copyWith(
        status: LoginStatus.failure,
        errorCode: failure.code,
      )),
      (session) => emit(state.copyWith(
        status: LoginStatus.success,
        session: session,
        clearError: true,
      )),
    );
  }

  void dismissError() => emit(state.copyWith(clearError: true));
}
