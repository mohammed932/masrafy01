import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import '../../../../../../../core/enums/request_state.dart';
import '../../../../../../../core/result/failure.dart';
import '../../../../../data/models/request/social/social_signin_request.dart';
import '../../../../../data/services/social_signin_service.dart';
import '../../../../../domain/entities/customer_entity.dart';
import '../../../../../domain/entities/social_session_entity.dart';
import '../../../../../domain/repositories/customer_auth_repository.dart';

part 'social_signin_cubit.freezed.dart';
part 'social_signin_state.dart';

/// Orchestrates native Google / Apple SDK calls + backend session creation.
///
/// Flow:
///   1. cubit.signInWithGoogle() / signInWithApple()
///   2. → `SocialSignInService` opens the native provider sheet, returns the
///        provider ID token + optional email/fullName.
///   3. → `CustomerAuthRepository.socialGoogle(idToken)` /
///        `.socialApple(idToken, userInfo…)` hits the backend.
///   4. Backend returns either:
///        a) `newCustomerSession` — brand-new lite SOCIAL customer + tokens
///           inline → emit loggedIn (status=loaded + customerSession set)
///        b) `existingCustomer` (returning user) — emit existingCustomer step;
///           UI calls `exchangeExisting()` which hits `/auth/social/login` to
///           issue tokens.
@injectable
class SocialSignInCubit extends Cubit<SocialSignInState> {
  SocialSignInCubit(this._repo, this._native)
      : super(const SocialSignInState());

  final CustomerAuthRepository _repo;
  final SocialSignInService _native;

  Future<void> signInWithGoogle() async {
    if (state.status.isLoading) return;
    emit(state.copyWith(
      status: RequestState.loading,
      step: SocialSignInStep.signingIn,
      cancelled: false,
      error: null,
    ));
    try {
      final native = await _native.signInWithGoogle();
      final result = await _repo.socialGoogle(
        SocialGoogleSignInRequest(idToken: native.idToken),
      );
      result.fold(
        (err) => emit(state.copyWith(status: RequestState.error, error: err)),
        _handleBackendResult,
      );
    } on SocialSignInCancelledException {
      emit(state.copyWith(
        status: RequestState.initial,
        step: SocialSignInStep.cancelled,
        cancelled: true,
      ));
    } catch (e) {
      emit(state.copyWith(
        status: RequestState.error,
        error: const UnknownFailure(),
      ));
    }
  }

  Future<void> signInWithApple() async {
    if (state.status.isLoading) return;
    emit(state.copyWith(
      status: RequestState.loading,
      step: SocialSignInStep.signingIn,
      cancelled: false,
      error: null,
    ));
    try {
      final native = await _native.signInWithApple();
      final result = await _repo.socialApple(
        SocialAppleSignInRequest(
          idToken: native.idToken,
          userInfoEmail: native.email,
          userInfoFullName: native.fullName,
        ),
      );
      result.fold(
        (err) => emit(state.copyWith(status: RequestState.error, error: err)),
        _handleBackendResult,
      );
    } on SocialSignInCancelledException {
      emit(state.copyWith(
        status: RequestState.initial,
        step: SocialSignInStep.cancelled,
        cancelled: true,
      ));
    } on SocialSignInProviderNotSupportedException {
      emit(state.copyWith(
        status: RequestState.error,
        error: const ServerFailure(code: 'APPLE_SIGNIN_UNAVAILABLE'),
      ));
    } catch (e) {
      emit(state.copyWith(
        status: RequestState.error,
        error: const UnknownFailure(),
      ));
    }
  }

  Future<void> exchangeExisting() async {
    final socialSession = state.socialSession;
    if (socialSession == null) return;
    final sid = socialSession.socialSessionId;
    if (sid == null) {
      emit(state.copyWith(
        status: RequestState.error,
        error: const ServerFailure(code: 'SOCIAL_SESSION_MISSING'),
      ));
      return;
    }
    if (state.status.isLoading) return;
    emit(state.copyWith(
      status: RequestState.loading,
      step: SocialSignInStep.exchanging,
      error: null,
    ));
    final result = await _repo.socialLogin(
      SocialLoginRequest(socialSessionId: sid),
    );
    result.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (sess) => emit(state.copyWith(
        status: RequestState.loaded,
        step: SocialSignInStep.loggedIn,
        customerSession: sess,
        error: null,
      )),
    );
  }

  void _handleBackendResult(SocialSessionEntity sess) {
    if (sess.newCustomerSession != null) {
      emit(state.copyWith(
        status: RequestState.loaded,
        step: SocialSignInStep.loggedIn,
        socialSession: sess,
        customerSession: sess.newCustomerSession,
        error: null,
      ));
    } else {
      emit(state.copyWith(
        status: RequestState.loaded,
        step: SocialSignInStep.existingCustomer,
        socialSession: sess,
        error: null,
      ));
    }
  }

  void reset() => emit(const SocialSignInState());
}
