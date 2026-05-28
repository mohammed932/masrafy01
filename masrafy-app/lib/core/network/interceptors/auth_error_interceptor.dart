import 'dart:async';

import 'package:dio/dio.dart';

import '../../services/auth/session_expiration_handler.dart';
import '../../enums/logout_reason.dart';
import '../api_strings.dart';

// Endpoints that show their own auth errors (login forms, public catalogs).
final _publicPaths = [
  ApiStrings.authLogin,
  ApiStrings.authGoogleLogin,
  ApiStrings.authRegister,
  ApiStrings.authLogout,
  ApiStrings.authForgotPassword,
  ApiStrings.authResetPassword,
  ApiStrings.authCsrfRefresh,
  ApiStrings.authCheckActiveSession,
  ApiStrings.authResendVerification,
  ApiStrings.countries,
  ApiStrings.eshopPackages,
  ApiStrings.dashboardPackages,
];

// Phrases owned by other layers — never trigger a logout.
const _ignoredPhrases = [
  'csrf',
  'xsrf',
  'subscription',
  'package',
  'trial',
  'invalid credentials',
  'invalid email or password',
];

// Server message → logout reason. First match wins.
const _reasonByPhrase = <String, LogoutReason>{
  'login on another device': LogoutReason.anotherDevice,
  'another device': LogoutReason.anotherDevice,
  'logged in elsewhere': LogoutReason.anotherDevice,
  'session has been invalidated': LogoutReason.sessionInvalidated,
  'token has been revoked': LogoutReason.sessionInvalidated,
  'session invalidated': LogoutReason.sessionInvalidated,
  'no active session': LogoutReason.sessionExpired,
  'session token is invalid': LogoutReason.sessionExpired,
  'please log in again': LogoutReason.sessionExpired,
};

/// Force-logs-out the user on session-fatal 401/403.
/// Must run AFTER `CsrfRefreshInterceptor`.
///
/// Takes a [SessionExpirationHandler] *resolver* — not the instance —
/// because constructing the handler eagerly inside [DioHelper]'s ctor
/// creates a circular DI graph (BaseNetwork → SessionExpirationHandler →
/// UnreadCountService → NotificationsUseCase → NotificationsDataSource →
/// BaseNetwork). Resolving lazily on each error breaks the cycle since
/// the dependency chain is already wired by the time an HTTP error
/// actually fires.
class AuthErrorInterceptor extends Interceptor {
  AuthErrorInterceptor(this._sessionHandlerResolver);

  final SessionExpirationHandler Function() _sessionHandlerResolver;

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final reason = _classify(err);
    if (reason != null) {
      // `forceLogout` flips `isLoggingOut` synchronously before any
      // await, so by the time `ApiHandler.callApi` catches the
      // resulting UnauthorizedException it sees the flag set and
      // hangs the future — UI never emits an error state, the user
      // just slides to Login.
      unawaited(_sessionHandlerResolver().forceLogout(reason));
    }
    handler.next(err);
  }

  LogoutReason? _classify(DioException err) {
    final status = err.response?.statusCode;
    if (status != 401 && status != 403) return null;

    final path = err.requestOptions.uri.path;
    if (_publicPaths.any(path.contains)) return null;

    final message = _readMessage(err.response?.data);
    if (_ignoredPhrases.any(message.contains)) return null;

    for (final entry in _reasonByPhrase.entries) {
      if (message.contains(entry.key)) return entry.value;
    }

    // Bare 401 = session gone. Bare 403 could be permissions, leave alone.
    return status == 401 ? LogoutReason.sessionExpired : null;
  }

  String _readMessage(Object? body) {
    if (body is Map) {
      final raw = body['message'] ?? body['error'] ?? body['code'];
      if (raw is String) return raw.toLowerCase();
      if (raw is List) return raw.whereType<String>().join(' ').toLowerCase();
    }
    return body is String ? body.toLowerCase() : '';
  }
}
