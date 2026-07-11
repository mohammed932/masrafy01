import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/auth/data/models/request/otp/otp_request.dart';
import 'package:app/features/auth/data/models/request/otp/otp_verify_request.dart';
import 'package:app/features/auth/data/models/request/profile/complete_profile_request.dart';
import 'package:app/features/auth/data/models/request/signup/signup_phone_verify_request.dart';
import 'package:app/features/auth/domain/entities/customer_entity.dart';
import 'package:app/features/auth/domain/entities/otp_challenge_entity.dart';
import 'package:app/features/auth/domain/entities/signup_draft.dart';
import 'package:app/features/auth/domain/enums/otp_purpose.dart';
import 'package:app/features/auth/domain/repositories/customer_auth_repository.dart';
import 'package:app/features/auth/domain/usecases/customer_auth_usecase.dart';

part 'otp_cubit.freezed.dart';
part 'otp_state.dart';

/// Verify-Account screen (Figma `137:2672`). Verifies the 6-digit SMS code and,
/// for SIGNUP, immediately completes the lite registration with the carried
/// [SignupDraft]. Owns the resend countdown timer. Orchestration only —
/// derivations live on [OtpState] (Principle XXXI).
@injectable
class OtpCubit extends Cubit<OtpState> {
  OtpCubit(this._auth) : super(const OtpState());

  final CustomerAuthUseCase _auth;
  Timer? _ticker;

  /// Seeds the cubit from the route args and starts the resend countdown.
  void start({
    required OtpChallengeEntity challenge,
    required OtpPurpose purpose,
    SignupDraft? draft,
  }) {
    emit(state.copyWith(
      challenge: challenge,
      purpose: purpose,
      draft: draft,
      secondsRemaining: challenge.resendAvailableInSeconds,
      code: '',
      error: null,
      status: RequestState.initial,
    ));
    _startTicker();
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

  void updateCode(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    final trimmed = digits.length > 6 ? digits.substring(0, 6) : digits;
    emit(state.copyWith(code: trimmed, error: null));
  }

  Future<void> verify() async {
    final challenge = state.challenge;
    final purpose = state.purpose;
    if (challenge == null || purpose == null || !state.canVerify) return;

    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _auth.verifyOtp(
      OtpVerifyRequest(otpId: challenge.otpId, code: state.code, purpose: purpose),
    );

    await res.fold(
      (err) async => emit(state.copyWith(
        status: RequestState.error,
        error: err,
        attemptsLeft: err.code == 'OTP_INVALID'
            ? (state.attemptsLeft - 1).clamp(0, 99)
            : state.attemptsLeft,
      )),
      (outcome) => _completeSignup(outcome),
    );
  }

  /// Creates the LITE account from the OTP-verified token, then silently
  /// finishes profile completion with the already-collected [SignupDraft]
  /// (name/birthday/email/password) — no separate user-facing form. Lands
  /// straight on Home when that succeeds; falls back to the Complete-Profile
  /// screen (prefilled from the same draft) if it doesn't, so the user is
  /// never stranded (Principle XXXVII, narrowed v9.0.0 — photo/National ID
  /// are optional and never part of this chain).
  Future<void> _completeSignup(OtpVerifyOutcome outcome) async {
    final draft = state.draft;
    final token = outcome.verifiedMobileToken;
    if (token == null || draft == null) {
      emit(state.copyWith(
        status: RequestState.error,
        error: const UnknownFailure(),
      ));
      return;
    }
    final verifyRes = await _auth.signupPhoneVerify(
      SignupPhoneVerifyRequest(verifiedMobileToken: token),
    );
    await verifyRes.fold(
      (err) async =>
          emit(state.copyWith(status: RequestState.error, error: err)),
      (liteSession) => _completeProfileSilently(draft, liteSession),
    );
  }

  Future<void> _completeProfileSilently(
    SignupDraft draft,
    CustomerSessionEntity liteSession,
  ) async {
    final res = await _auth.completeProfile(
      CompleteProfileRequest(
        firstName: draft.firstName,
        lastName: draft.lastName,
        birthday: draft.birthday,
        email: draft.email,
        password: draft.password,
      ),
    );
    emit(state.copyWith(
      status: RequestState.loaded,
      session: res.fold((_) => liteSession, (completed) => completed),
      error: null,
    ));
  }

  /// Re-issues the SMS code. [locale] is the active app language code.
  Future<void> resend(String locale) async {
    final draft = state.draft;
    final purpose = state.purpose;
    if (draft == null || purpose == null || !state.canResend) return;

    final res = await _auth.requestOtp(
      OtpRequestRequest(phone: draft.phone, purpose: purpose, locale: locale),
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

  @override
  Future<void> close() {
    _ticker?.cancel();
    return super.close();
  }
}
