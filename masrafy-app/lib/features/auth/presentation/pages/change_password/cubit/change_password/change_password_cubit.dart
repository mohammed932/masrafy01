import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/core/utils/validators.dart';
import 'package:app/features/auth/data/models/request/password/password_reset_request.dart';
import 'package:app/features/auth/domain/usecases/customer_auth_usecase.dart';

part 'change_password_cubit.freezed.dart';
part 'change_password_state.dart';

/// Change-Password screen (Settings & Security). Collects current + new +
/// confirm, submits to `POST /auth/password/change`. On success the backend
/// revokes every session, so the usecase clears local tokens and the screen
/// sends the user back to Login. Orchestration only — derivations live on
/// [ChangePasswordState] (Principle XXXI).
@injectable
class ChangePasswordCubit extends Cubit<ChangePasswordState> {
  ChangePasswordCubit(this._customerAuth) : super(const ChangePasswordState());

  final CustomerAuthUseCase _customerAuth;

  void updateField(ChangePasswordField field, String value) {
    switch (field) {
      case ChangePasswordField.currentPassword:
        emit(state.copyWith(currentPassword: value, error: null));
      case ChangePasswordField.newPassword:
        emit(state.copyWith(newPassword: value, error: null));
      case ChangePasswordField.confirmPassword:
        emit(state.copyWith(confirmPassword: value, error: null));
    }
  }

  void toggleObscure(ChangePasswordField field) {
    switch (field) {
      case ChangePasswordField.currentPassword:
        emit(state.copyWith(obscureCurrent: !state.obscureCurrent));
      case ChangePasswordField.newPassword:
        emit(state.copyWith(obscureNew: !state.obscureNew));
      case ChangePasswordField.confirmPassword:
        emit(state.copyWith(obscureConfirm: !state.obscureConfirm));
    }
  }

  Future<void> submit() async {
    if (!state.canSubmit) return;
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _customerAuth.changePassword(
      PasswordChangeRequest(
        currentPassword: state.currentPassword,
        newPassword: state.newPassword,
      ),
    );
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (_) => emit(state.copyWith(status: RequestState.loaded, error: null)),
    );
  }
}
