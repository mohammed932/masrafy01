import 'package:bloc/bloc.dart';
import 'package:flutter/foundation.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/core/services/google_signin_service.dart';
import 'package:app/features/auth/data/models/request/login/login_request.dart';
import 'package:app/features/auth/data/models/request/social/social_signin_request.dart';
import 'package:app/features/auth/domain/entities/customer_entity.dart';
import 'package:app/features/auth/domain/usecases/auth_usecase.dart';
import 'package:app/features/auth/domain/usecases/customer_auth_usecase.dart';

part 'login_cubit.freezed.dart';
part 'login_state.dart';

/// Email + password login (Figma `77:1032`). Routes through
/// [AuthUseCase] so the customer-JWT tokens are persisted to
/// `flutter_secure_storage` on success (Principle XXVIII). The backend
/// applies the FR-022 lockout server-side, so no client lockout logic.
@injectable
class LoginCubit extends Cubit<LoginState> {
  LoginCubit(this._auth, this._customerAuth, this._google)
      : super(const LoginState());

  final AuthUseCase _auth;
  final CustomerAuthUseCase _customerAuth;
  final GoogleSignInService _google;

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

  /// Google SOCIAL sign-in. Emits the same loading/loaded(session)/error
  /// transitions as [submit], so the login page's [BlocConsumer] routes on
  /// `session.customer.profileComplete` (Home vs Complete-Profile) unchanged.
  /// A cancelled account chooser returns to idle silently (no error toast).
  Future<void> signInWithGoogle() async {
    if (state.isBusy) return;
    emit(state.copyWith(status: RequestState.loading, error: null));
    try {
      final tokens = await _google.obtainTokens();
      if (tokens == null) {
        // User dismissed the Google account chooser — back to idle, no toast.
        emit(state.copyWith(status: RequestState.initial));
        return;
      }
      final res = await _customerAuth.signInWithGoogle(
        SocialGoogleSignInRequest(
          idToken: tokens.idToken,
          accessToken: tokens.accessToken,
        ),
      );
      res.fold(
        (err) => emit(state.copyWith(status: RequestState.error, error: err)),
        (session) => emit(state.copyWith(
          status: RequestState.loaded,
          session: session,
          error: null,
        )),
      );
    } catch (e) {
      // Native Google-side failure (e.g. PlatformException DEVELOPER_ERROR when
      // the SHA-1 / client id is misregistered). Surface as a typed error so the
      // page shows a toast instead of the spinner hanging.
      if (kDebugMode) debugPrint('Google sign-in failed: $e');
      emit(state.copyWith(
        status: RequestState.error,
        error: const ServerFailure(code: 'SOCIAL_SIGN_IN_FAILED'),
      ));
    }
  }

  void reset() => emit(const LoginState());
}
