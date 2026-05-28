import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../data/models/request/social/social_signin_request.dart';
import '../../data/services/social_signin_service.dart';
import '../../domain/entities/customer_entity.dart';
import '../../domain/entities/social_session_entity.dart';
import '../../domain/repositories/customer_auth_repository.dart';

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
///           inline → emit `SocialSignInLoggedIn`
///        b) `existingCustomer` (returning user) — emit
///           `SocialSignInExistingCustomer`; UI calls `exchangeExisting()`
///           which hits `/auth/social/login` to issue tokens.
abstract class SocialSignInState extends Equatable {
  const SocialSignInState();
  @override
  List<Object?> get props => [];
}

class SocialSignInIdle extends SocialSignInState {
  const SocialSignInIdle();
}

class SocialSignInInProgress extends SocialSignInState {
  const SocialSignInInProgress();
}

class SocialSignInExistingCustomer extends SocialSignInState {
  const SocialSignInExistingCustomer(this.session);
  final SocialSessionEntity session;
  @override
  List<Object?> get props => [session];
}

class SocialSignInLoggedIn extends SocialSignInState {
  const SocialSignInLoggedIn(this.session);
  final CustomerSessionEntity session;
  @override
  List<Object?> get props => [session];
}

class SocialSignInCancelled extends SocialSignInState {
  const SocialSignInCancelled();
}

class SocialSignInFailure extends SocialSignInState {
  const SocialSignInFailure(this.error);
  final Object error;
  @override
  List<Object?> get props => [error];
}

class SocialSignInCubit extends Cubit<SocialSignInState> {
  SocialSignInCubit(this._repo, this._native) : super(const SocialSignInIdle());
  final CustomerAuthRepository _repo;
  final SocialSignInService _native;

  Future<void> signInWithGoogle() async {
    emit(const SocialSignInInProgress());
    try {
      final native = await _native.signInWithGoogle();
      final result = await _repo.socialGoogle(
        SocialGoogleSignInRequest(idToken: native.idToken),
      );
      result.fold(
        (err) => emit(SocialSignInFailure(err)),
        (sess) => _handleBackendResult(sess),
      );
    } on SocialSignInCancelledException {
      emit(const SocialSignInCancelled());
    } catch (e) {
      emit(SocialSignInFailure(e));
    }
  }

  Future<void> signInWithApple() async {
    emit(const SocialSignInInProgress());
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
        (err) => emit(SocialSignInFailure(err)),
        (sess) => _handleBackendResult(sess),
      );
    } on SocialSignInCancelledException {
      emit(const SocialSignInCancelled());
    } on SocialSignInProviderNotSupportedException {
      emit(const SocialSignInFailure('apple_signin_unavailable'));
    } catch (e) {
      emit(SocialSignInFailure(e));
    }
  }

  Future<void> exchangeExisting() async {
    final s = state;
    if (s is! SocialSignInExistingCustomer) return;
    final sid = s.session.socialSessionId;
    if (sid == null) {
      emit(const SocialSignInFailure('social_session_missing'));
      return;
    }
    emit(const SocialSignInInProgress());
    final result = await _repo.socialLogin(SocialLoginRequest(socialSessionId: sid));
    result.fold(
      (err) => emit(SocialSignInFailure(err)),
      (sess) => emit(SocialSignInLoggedIn(sess)),
    );
  }

  void _handleBackendResult(SocialSessionEntity sess) {
    if (sess.newCustomerSession != null) {
      emit(SocialSignInLoggedIn(sess.newCustomerSession!));
    } else {
      emit(SocialSignInExistingCustomer(sess));
    }
  }

  void reset() => emit(const SocialSignInIdle());
}
