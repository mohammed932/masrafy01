import 'package:dio/dio.dart';

import '../../storage/customer_session_storage.dart';
import '../api_strings.dart';

/// On `401` from any `/api/v1/*` call, silently rotates the customer JWT via
/// `POST /api/v1/auth/refresh`, then retries the original request once
/// (Constitution Principle XXVIII — Dio bearer interceptor + silent refresh
/// on 401). A single refresh runs even when many requests 401 at once.
///
/// The retry is replayed through the main [Dio], so [CustomerJwtInterceptor]
/// re-reads storage and attaches the freshly-saved access token — no manual
/// header patching here.
class CustomerJwtRefreshInterceptor extends Interceptor {
  CustomerJwtRefreshInterceptor({
    required Dio dio,
    required CustomerSessionStorage storage,
    required String baseUrl,
  })  : _dio = dio,
        _storage = storage,
        // Bare client for the refresh call — NO interceptors, so a 401 on the
        // refresh request itself can't recurse back into this handler.
        _refreshClient = Dio(BaseOptions(baseUrl: baseUrl));

  final Dio _dio;
  final CustomerSessionStorage _storage;
  final Dio _refreshClient;

  /// Single-flight latch: the in-progress refresh shared by every request that
  /// 401s while it runs. Cleared on completion so a later expiry refreshes
  /// again. Resolves to `true` when a fresh session was saved.
  Future<bool>? _refreshing;

  /// Auth endpoints that must never trigger a refresh-retry (would loop, or
  /// have no session to refresh yet).
  static const _authPaths = <String>{
    ApiStrings.authRefresh,
    ApiStrings.authLogin,
    ApiStrings.authSignup,
  };

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode != 401 ||
        _isAuthPath(err.requestOptions.path)) {
      return handler.next(err);
    }

    final refreshed = await _ensureRefreshed();

    if (!refreshed) {
      // Unrecoverable: refresh token missing, expired, or reuse-revoked.
      // Drop the dead session. (No Login route exists yet — the router is an
      // empty scaffold pending the presentation rebuild. Once it lands, hook
      // an explicit redirect here with LogoutReason.sessionExpired.)
      await _storage.clear();
      return handler.next(err);
    }

    try {
      final clone = await _dio.fetch<dynamic>(err.requestOptions);
      return handler.resolve(clone);
    } on DioException catch (retryErr) {
      return handler.next(retryErr);
    }
  }

  /// Coalesces concurrent 401s onto one refresh. The latch self-clears once
  /// the refresh settles (success or failure), before any waiter resumes.
  Future<bool> _ensureRefreshed() {
    return _refreshing ??=
        _refresh().whenComplete(() => _refreshing = null);
  }

  /// Returns `true` when a fresh session was obtained and persisted.
  Future<bool> _refresh() async {
    final refreshToken = await _storage.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) return false;

    try {
      final response = await _refreshClient.post<dynamic>(
        ApiStrings.authRefresh,
        data: <String, dynamic>{'refreshToken': refreshToken},
      );
      final body = response.data;
      if (body is! Map<String, dynamic>) return false;
      final data = body['data'];
      if (data is! Map<String, dynamic>) return false;

      final accessToken = data['accessToken'];
      final newRefreshToken = data['refreshToken'];
      final customer = data['customer'];
      if (accessToken is! String ||
          newRefreshToken is! String ||
          customer is! Map<String, dynamic>) {
        return false;
      }
      final customerId = customer['id'];
      if (customerId is! String) return false;

      await _storage.save(
        accessToken: accessToken,
        refreshToken: newRefreshToken,
        customerId: customerId,
      );
      return true;
    } on DioException {
      return false;
    }
  }

  bool _isAuthPath(String path) =>
      _authPaths.any((p) => path == p || path.endsWith(p));
}
