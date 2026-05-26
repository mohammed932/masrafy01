import 'package:dio/dio.dart';

import '../../cache/secure_storage.dart';
import '../../injection/injection.dart';
import '../../services/firebase_auth_service.dart';
import '../../enums/storage_keys.dart';
import '../api_strings.dart';
import '../endpoint.dart';

/// On `403` with a CSRF-related body, silently re-POSTs `/auth/login` to
/// obtain a fresh session + CSRF token (the Firebase ID token is still
/// valid in-memory, so the backend accepts the re-auth without prompting
/// the user), then retries the original request once.
///
/// Mobile-native alternative to the cookie-backed `/auth/csrf-token`
/// refresh the Angular web client uses — mobile stays cookie-free.
class CsrfRefreshInterceptor extends Interceptor {
  final Dio _dio;
  final _storage = getIt<SecureStorage>();
  bool _refreshing = false;

  CsrfRefreshInterceptor(this._dio);

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final status = err.response?.statusCode;
    final body = err.response?.data;
    if (status != 403 || !_isCsrfError(body) || _refreshing) {
      return handler.next(err);
    }

    // Can't refresh without a live Firebase user.
    if (getIt<FirebaseAuthService>().currentUser == null) {
      return handler.next(err);
    }

    _refreshing = true;
    try {
      // Drop the stale token so the re-login request doesn't send it.
      await _storage.deleteValue(StorageKeys.csrfToken);

      // Re-POST /auth/login — Firebase token is attached by HttpInterceptor;
      // HttpInterceptor.onResponse captures the new csrfToken into storage.
      final endpoint = PilotEndpoint(endpoint: ApiStrings.authLogin);
      await _dio.post(endpoint.fullUrl);

      // Retry the original request with the fresh CSRF token.
      final clone = await _dio.fetch(err.requestOptions);
      return handler.resolve(clone);
    } catch (_) {
      // Re-login failed — let the original 403 propagate so the user
      // is bounced to Login by the outer error handler.
      return handler.next(err);
    } finally {
      _refreshing = false;
    }
  }

  static bool _isCsrfError(dynamic body) {
    if (body is Map<String, dynamic>) {
      final msg =
          (body['message'] ?? body['error'] ?? body['code'])?.toString();
      if (msg == null) return false;
      final lower = msg.toLowerCase();
      return lower.contains('csrf') || lower.contains('xsrf');
    }
    return false;
  }
}
