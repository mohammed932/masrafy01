import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import '../../../../../../../core/enums/request_state.dart';
import '../../../../../../../core/result/failure.dart';
import '../../../../../data/models/request/otp/otp_request.dart';
import '../../../../../data/models/request/otp/otp_verify_request.dart';
import '../../../../../data/models/request/password/password_reset_request.dart';
import '../../../../../domain/entities/customer_entity.dart';
import '../../../../../domain/entities/otp_challenge_entity.dart';
import '../../../../../domain/enums/otp_purpose.dart';
import '../../../../../domain/repositories/customer_auth_repository.dart';

part 'forgot_password_cubit.freezed.dart';
part 'forgot_password_state.dart';

@injectable
class ForgotPasswordCubit extends Cubit<ForgotPasswordState> {
  ForgotPasswordCubit(this._repo) : super(const ForgotPasswordState());

  final CustomerAuthRepository _repo;

  void updateField(ForgotPasswordField field, Object value) {
    switch (field) {
      case ForgotPasswordField.phone:
        emit(state.copyWith(phone: value as String));
        break;
      case ForgotPasswordField.otpCode:
        emit(state.copyWith(otpCode: value as String));
        break;
      case ForgotPasswordField.newPassword:
        emit(state.copyWith(newPassword: value as String));
        break;
      case ForgotPasswordField.locale:
        emit(state.copyWith(locale: value as String));
        break;
    }
  }

  Future<void> requestOtp() async {
    if (state.status.isLoading) return;
    emit(state.copyWith(
      status: RequestState.loading,
      step: ForgotPasswordStep.requestingOtp,
      error: null,
    ));
    final res = await _repo.requestOtp(
      OtpRequestRequest(
        phone: state.phone,
        purpose: OtpPurpose.forgotPassword,
        locale: state.locale,
      ),
    );
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (ch) => emit(state.copyWith(
        status: RequestState.loaded,
        step: ForgotPasswordStep.otpSent,
        challenge: ch,
        error: null,
      )),
    );
  }

  Future<void> verifyOtp() async {
    if (state.challenge == null) return;
    if (state.status.isLoading) return;
    emit(state.copyWith(
      status: RequestState.loading,
      step: ForgotPasswordStep.verifying,
      error: null,
    ));
    final res = await _repo.verifyOtp(
      OtpVerifyRequest(
        otpId: state.challenge!.otpId,
        code: state.otpCode,
        purpose: OtpPurpose.forgotPassword,
      ),
    );
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (out) {
        if (out.passwordResetToken == null) {
          emit(state.copyWith(
            status: RequestState.error,
            error: const ServerFailure(code: 'NO_RESET_TOKEN_ISSUED'),
          ));
          return;
        }
        emit(state.copyWith(
          status: RequestState.loaded,
          step: ForgotPasswordStep.tokenIssued,
          passwordResetToken: out.passwordResetToken,
          error: null,
        ));
      },
    );
  }

  Future<void> reset() async {
    if (state.passwordResetToken == null) return;
    if (state.status.isLoading) return;
    emit(state.copyWith(
      status: RequestState.loading,
      step: ForgotPasswordStep.resetting,
      error: null,
    ));
    final res = await _repo.resetPassword(
      PasswordResetRequest(
        passwordResetToken: state.passwordResetToken!,
        newPassword: state.newPassword,
      ),
    );
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (sess) => emit(state.copyWith(
        status: RequestState.loaded,
        step: ForgotPasswordStep.success,
        session: sess,
        error: null,
      )),
    );
  }

  void clearError() => emit(state.copyWith(error: null));
}
