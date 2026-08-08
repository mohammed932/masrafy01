import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:dartz/dartz.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/auth/data/models/request/otp/otp_request.dart';
import 'package:app/features/auth/data/models/request/otp/otp_verify_request.dart';
import 'package:app/features/auth/data/models/request/profile/complete_profile_request.dart';
import 'package:app/features/auth/data/models/request/profile/profile_completion_request.dart';
import 'package:app/features/auth/data/models/request/signup/signup_phone_verify_request.dart';
import 'package:app/features/auth/domain/entities/customer_entity.dart';
import 'package:app/features/auth/domain/entities/otp_challenge_entity.dart';
import 'package:app/features/auth/domain/entities/signup_draft.dart';
import 'package:app/features/auth/domain/enums/otp_purpose.dart';
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
    String? phone,
  }) {
    emit(state.copyWith(
      challenge: challenge,
      purpose: purpose,
      draft: draft,
      phone: phone,
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

  /// Verifies the SMS code and drives the signup pipeline
  /// (`otp/verify` → `signup/phone/verify` → `completeProfile`) to Home.
  ///
  /// The pipeline is **resumable**: the OTP is single-use, so after it has been
  /// verified once, re-running `otp/verify` would fail `OTP_CONSUMED`. If a
  /// later step fails and the user taps Verify again, we resume from the failed
  /// step using the retained [OtpState.verifiedMobileToken] / lite
  /// [OtpState.session] instead of re-verifying the OTP.
  Future<void> verify() async {
    final purpose = state.purpose;
    if (purpose == null || !state.canVerify) return;

    // SOCIAL PROFILE_MOBILE binding: verify the OTP, then let the page route on
    // to the birthday step of profile completion (mobile is now bound, so
    // `completeProfile` will succeed). No SignupDraft / signup pipeline here.
    if (purpose == OtpPurpose.profileMobile) return _verifyProfileMobile();

    final draft = state.draft;
    if (draft == null) return;

    emit(state.copyWith(status: RequestState.loading, error: null));

    // Resume: lite account already created → only profile completion remains.
    final lite = state.session;
    if (lite != null) return _completeProfileSilently(draft, lite);

    // Resume: OTP already verified → create lite account, then complete.
    final token = state.verifiedMobileToken;
    if (token != null) return _signupThenComplete(token, draft);

    // First attempt: verify the single-use OTP.
    final challenge = state.challenge;
    if (challenge == null) return;
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
      (outcome) async {
        final verifiedToken = outcome.verifiedMobileToken;
        if (verifiedToken == null) {
          emit(state.copyWith(
            status: RequestState.error,
            error: const UnknownFailure(),
          ));
          return;
        }
        // Retain the single-use token so a retry skips re-verification.
        emit(state.copyWith(verifiedMobileToken: verifiedToken));
        await _signupThenComplete(verifiedToken, draft);
      },
    );
  }

  /// SOCIAL PROFILE_MOBILE: verifies the mobile-binding OTP. On success the
  /// backend persists the phone + `mobileVerifiedAt`; the page then routes to
  /// the birthday step (Complete-Profile). No session is issued here — the
  /// caller keeps its existing Google-issued session.
  Future<void> _verifyProfileMobile() async {
    final challenge = state.challenge;
    if (challenge == null) return;
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _auth.profileMobileVerifyOtp(
      ProfileMobileVerifyOtpRequest(otpId: challenge.otpId, code: state.code),
    );
    res.fold(
      (err) => emit(state.copyWith(
        status: RequestState.error,
        error: err,
        attemptsLeft: err.code == 'OTP_INVALID'
            ? (state.attemptsLeft - 1).clamp(0, 99)
            : state.attemptsLeft,
      )),
      (_) => emit(state.copyWith(status: RequestState.loaded, error: null)),
    );
  }

  /// Creates the LITE account from the OTP-verified token, then silently
  /// finishes profile completion with the already-collected [SignupDraft]
  /// (name/birthday/email/password) — no separate user-facing form. Lands
  /// straight on Home when that succeeds; surfaces the error (staying on the
  /// OTP screen to retry) if it doesn't, so the account is never left
  /// incomplete behind Home (Principle XXXVII, narrowed v9.0.0 — photo/National
  /// ID are optional and never part of this chain).
  Future<void> _signupThenComplete(String token, SignupDraft draft) async {
    final verifyRes = await _auth.signupPhoneVerify(
      SignupPhoneVerifyRequest(verifiedMobileToken: token),
    );
    await verifyRes.fold(
      (err) async =>
          emit(state.copyWith(status: RequestState.error, error: err)),
      (liteSession) async {
        // Retain the lite session (status stays loading → no premature nav) so
        // a retry resumes at completeProfile, not the consumed OTP.
        emit(state.copyWith(session: liteSession));
        await _completeProfileSilently(draft, liteSession);
      },
    );
  }

  Future<void> _completeProfileSilently(
    SignupDraft draft,
    CustomerSessionEntity lite,
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
    await res.fold(
      (err) async => emit(state.copyWith(
        status: RequestState.error,
        error: err,
        session: lite,
      )),
      (completed) async {
        // Session exists now, so the National-ID sides captured on the signup
        // screen can finally be uploaded (the endpoints are customer-scoped).
        final idFailed = await _uploadCarriedNationalId(draft);
        emit(state.copyWith(
          status: RequestState.loaded,
          session: completed,
          error: null,
          // Not an error: the account IS created and usable. The flag only
          // tells the page to say the ID must be re-added from the profile,
          // rather than dropping the customer's capture in silence.
          nationalIdUploadFailed: idFailed,
        ));
      },
    );
  }

  /// Uploads whichever National-ID sides the signup screen captured. Never
  /// blocks the signup: National ID is optional until the select-offer step
  /// (Principle XXXVII / v9.1.0), so a failure returns `true` for the page to
  /// mention and the customer keeps a working account either way.
  Future<bool> _uploadCarriedNationalId(SignupDraft draft) async {
    var failed = false;
    for (final (front, image) in [
      (true, draft.nationalIdFront),
      (false, draft.nationalIdBack),
    ]) {
      if (image == null) continue;
      final res = await _auth.uploadNationalIdSide(
        UploadNationalIdRequest(
          documentType: front ? 'NATIONAL_ID_FRONT' : 'NATIONAL_ID_BACK',
          bytes: image.bytes,
          contentType: image.contentType,
          filename: image.filename,
        ),
      );
      if (res.isLeft()) failed = true;
    }
    return failed;
  }

  /// Re-issues the SMS code. [locale] is the active app language code.
  Future<void> resend(String locale) async {
    final purpose = state.purpose;
    if (purpose == null || !state.canResend) return;

    // SOCIAL PROFILE_MOBILE re-issues via the authenticated binding endpoint
    // (there is no SignupDraft on this path — the phone is carried in state).
    final Future<Either<Failure, OtpChallengeEntity>> request;
    if (purpose == OtpPurpose.profileMobile) {
      final phone = state.phone;
      if (phone == null) return;
      request = _auth.profileMobileRequestOtp(
        ProfileMobileRequestOtpRequest(phone: phone),
      );
    } else {
      final draft = state.draft;
      if (draft == null) return;
      request = _auth.requestOtp(
        OtpRequestRequest(phone: draft.phone, purpose: purpose, locale: locale),
      );
    }

    final res = await request;
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
