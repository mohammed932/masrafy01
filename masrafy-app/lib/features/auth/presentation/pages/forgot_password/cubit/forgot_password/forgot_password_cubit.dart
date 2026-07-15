import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/core/utils/validators.dart';
import 'package:app/features/auth/data/models/request/otp/otp_request.dart';
import 'package:app/features/auth/data/models/request/otp/otp_verify_request.dart';
import 'package:app/features/auth/data/models/request/password/password_reset_request.dart';
import 'package:app/features/auth/domain/entities/otp_challenge_entity.dart';
import 'package:app/features/auth/domain/enums/otp_purpose.dart';
import 'package:app/features/auth/domain/usecases/customer_auth_usecase.dart';

part 'forgot_password_cubit.freezed.dart';
part 'forgot_password_state.dart';

/// Forgot-Password flow (PHONE/OTP, Principle XIII — forgot-password PHONE-only).
/// A single screen with three internal steps driven by [ForgotPasswordStep]:
/// enter phone → verify the SMS code → set a new password. Orchestration only;
/// derivations live on [ForgotPasswordState] (Principle XXXI). Owns the resend
/// countdown timer.
@injectable
class ForgotPasswordCubit extends Cubit<ForgotPasswordState> {
  ForgotPasswordCubit(this._auth) : super(const ForgotPasswordState());

  final CustomerAuthUseCase _auth;
  Timer? _ticker;

  void updatePhone(String value) =>
      emit(state.copyWith(phone: value, error: null));

  void updateDialCode(String value) =>
      emit(state.copyWith(dialCode: value, error: null));

  void updateCode(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    final trimmed = digits.length > 6 ? digits.substring(0, 6) : digits;
    emit(state.copyWith(code: trimmed, error: null));
  }

  void updateNewPassword(String value) =>
      emit(state.copyWith(newPassword: value, error: null));

  void updateConfirmPassword(String value) =>
      emit(state.copyWith(confirmPassword: value, error: null));

  void toggleObscureNew() =>
      emit(state.copyWith(obscureNew: !state.obscureNew));

  void toggleObscureConfirm() =>
      emit(state.copyWith(obscureConfirm: !state.obscureConfirm));

  /// Steps back to the phone step from the OTP step (the page's back button).
  void backToPhone() => emit(state.copyWith(
        step: ForgotPasswordStep.phone,
        code: '',
        error: null,
        status: RequestState.initial,
      ));

  /// Step 1 → issues the SMS OTP for the entered phone and advances to the OTP
  /// step. [locale] is the active app language code.
  Future<void> sendCode(String locale) async {
    if (!state.canSendCode) return;
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _auth.requestOtp(
      OtpRequestRequest(
        phone: state.fullPhone,
        purpose: OtpPurpose.forgotPassword,
        locale: locale,
      ),
    );
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (challenge) {
        emit(state.copyWith(
          status: RequestState.initial,
          step: ForgotPasswordStep.otp,
          challenge: challenge,
          secondsRemaining: challenge.resendAvailableInSeconds,
          attemptsLeft: 3,
          code: '',
          error: null,
        ));
        _startTicker();
      },
    );
  }

  /// Re-issues the SMS code (resend countdown must have elapsed).
  Future<void> resend(String locale) async {
    if (!state.canResend) return;
    final res = await _auth.requestOtp(
      OtpRequestRequest(
        phone: state.fullPhone,
        purpose: OtpPurpose.forgotPassword,
        locale: locale,
      ),
    );
    res.fold(
      (err) => emit(state.copyWith(error: err)),
      (challenge) {
        emit(state.copyWith(
          challenge: challenge,
          secondsRemaining: challenge.resendAvailableInSeconds,
          code: '',
          error: null,
        ));
        _startTicker();
      },
    );
  }

  /// Step 2 → verifies the SMS code. On success the backend returns a
  /// `passwordResetToken` for PHONE customers; it is null for SOCIAL / unknown
  /// numbers (no-enumeration, FR-024) — surfaced as a neutral error that does
  /// NOT reveal whether the account exists.
  Future<void> verifyCode() async {
    final challenge = state.challenge;
    if (challenge == null || !state.canVerify) return;
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _auth.verifyOtp(
      OtpVerifyRequest(
        otpId: challenge.otpId,
        code: state.code,
        purpose: OtpPurpose.forgotPassword,
      ),
    );
    res.fold(
      (err) {
        // A consumed / expired single-use code can't be retried — free the
        // Resend action immediately so the user isn't stuck on a dead
        // countdown waiting for a code they can no longer use.
        final spent = err.code == 'OTP_CONSUMED' || err.code == 'OTP_EXPIRED';
        emit(state.copyWith(
          status: RequestState.error,
          error: err,
          secondsRemaining: spent ? 0 : state.secondsRemaining,
          attemptsLeft: err.code == 'OTP_INVALID'
              ? (state.attemptsLeft - 1).clamp(0, 99)
              : state.attemptsLeft,
        ));
      },
      (outcome) {
        final token = outcome.passwordResetToken;
        if (token == null) {
          // Verifying consumed the single-use OTP but no reset token came back
          // (unknown / SOCIAL number, no-enumeration). The code is now spent —
          // free Resend so the user can request a fresh one.
          emit(state.copyWith(
            status: RequestState.error,
            error: const ServerFailure(code: 'RESET_UNAVAILABLE'),
            secondsRemaining: 0,
          ));
          return;
        }
        emit(state.copyWith(
          status: RequestState.initial,
          step: ForgotPasswordStep.newPassword,
          passwordResetToken: token,
          error: null,
        ));
      },
    );
  }

  /// Step 3 → sets the new password using the reset token. On success the
  /// backend revokes all sessions and the usecase clears the local one; the
  /// page routes back to Login.
  Future<void> submit() async {
    final token = state.passwordResetToken;
    if (token == null || !state.canSubmit) return;
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _auth.resetPassword(
      PasswordResetRequest(
        passwordResetToken: token,
        newPassword: state.newPassword,
      ),
    );
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (_) => emit(state.copyWith(status: RequestState.loaded, error: null)),
    );
  }

  void _startTicker() {
    _ticker?.cancel();
    if (state.secondsRemaining <= 0) return;
    _ticker = Timer.periodic(const Duration(seconds: 1), (t) {
      final next = state.secondsRemaining - 1;
      emit(state.copyWith(secondsRemaining: next < 0 ? 0 : next));
      if (next <= 0) t.cancel();
    });
  }

  @override
  Future<void> close() {
    _ticker?.cancel();
    return super.close();
  }
}
