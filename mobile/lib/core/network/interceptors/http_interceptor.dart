import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';

import '../../cache/secure_storage.dart';
import '../../extentions/string_extention.dart';
import '../../injection/injection.dart';
import '../../services/device_id_service.dart';
import '../../services/firebase_auth_service.dart';
import '../../enums/storage_keys.dart';

class HttpInterceptor extends Interceptor {
  HttpInterceptor({required CookieJar cookieJar}) : _cookieJar = cookieJar;

  final _storage = getIt<SecureStorage>();
  final _deviceIdService = getIt<DeviceIdService>();
  final _firebaseAuthService = getIt<FirebaseAuthService>();
  final CookieJar _cookieJar;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Firebase Bearer token — attached when a Firebase user is signed in.
    if (_firebaseAuthService.currentUser != null) {
      try {
        final token = await _firebaseAuthService.getIdToken();
        options.headers['Authorization'] = 'Bearer $token';
      } catch (_) {
        // Fall through — backend will reject with 401 if needed.
      }
    }

    // Device ID — always attached.
    options.headers['X-Device-Id'] = await _deviceIdService.id;

    // CSRF header — attached on state-changing methods. Prefer the
    // `XSRF-TOKEN` cookie (set by the backend on login and any subsequent
    // response) over `SecureStorage` fallback, since the cookie is the
    // authoritative source and stays in sync automatically.
    final method = options.method.toUpperCase();
    final isMutation = method == 'POST' ||
        method == 'PUT' ||
        method == 'PATCH' ||
        method == 'DELETE';
    if (isMutation) {
      final csrf = await _readCsrfToken(options.uri);
      if (csrf.isNotNullOrEmpty) {
        options.headers['X-XSRF-TOKEN'] = csrf;
      }
    }

    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    // Mirror the CSRF token from `x-csrf-token` response header (or body
    // fallback) into SecureStorage. The CookieManager already persists the
    // `XSRF-TOKEN` cookie; this is defensive backup for flows that don't
    // pass through the cookie jar (e.g. retry interceptors).
    final headerCsrf = response.headers.value('x-csrf-token');
    if (headerCsrf != null && headerCsrf.isNotEmpty) {
      _storage.setValue(StorageKeys.csrfToken, headerCsrf);
    } else {
      final data = response.data;
      if (data is Map<String, dynamic>) {
        final bodyCsrf = data['csrfToken'];
        if (bodyCsrf is String && bodyCsrf.isNotEmpty) {
          _storage.setValue(StorageKeys.csrfToken, bodyCsrf);
        }
      }
    }
    handler.next(response);
  }

  Future<String?> _readCsrfToken(Uri uri) async {
    final cookies = await _cookieJar.loadForRequest(uri);
    for (final c in cookies) {
      if (c.name == 'XSRF-TOKEN' && c.value.isNotEmpty) return c.value;
    }
    return _storage.getValue(key: StorageKeys.csrfToken);
  }
}
