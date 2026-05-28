import 'dart:developer';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter/material.dart';
import 'package:injectable/injectable.dart';

import '../../cache/secure_storage.dart';
import '../../router/router.dart';
import '../../enums/storage_keys.dart';
import '../../enums/logout_reason.dart';
import '../../widgets/toasts/masrafy_error_toast.dart';
import '../firebase_auth_service.dart';
import '../unread_count/unread_count_service.dart';
import '../user_service.dart';

/// Tears down auth state and bounces the user to the login screen with
/// a reason banner. Called by [AuthErrorInterceptor] when the server
/// rejects a request with a session-fatal error (revoked token, kicked
/// by another device, invalidated session, etc.).
///
/// Idempotent — concurrent failing requests all funnel here, but only
/// the first one runs the teardown + navigation.
@lazySingleton
class SessionExpirationHandler {
  SessionExpirationHandler(
    this._router,
    this._firebaseAuth,
    this._userService,
    this._secureStorage,
    this._unreadCount,
    this._cookieJar,
  );

  final AppRouter _router;
  final FirebaseAuthService _firebaseAuth;
  final UserService _userService;
  final SecureStorage _secureStorage;
  final UnreadCountService _unreadCount;
  final CookieJar _cookieJar;

  bool _loggingOut = false;

  /// `true` from the moment a force-logout starts until the navigation
  /// to Login completes. Read by `ApiHandler.callApi` so any in-flight
  /// request that races the same 401 silently swallows its error
  /// instead of letting the calling cubit emit a "Unauthorized" UI
  /// state behind the login screen.
  bool get isLoggingOut => _loggingOut;

  Future<void> forceLogout(LogoutReason reason) async {
    if (_loggingOut) return;
    _loggingOut = true;
    log('Force logout: ${reason.remote}', name: 'SessionExpirationHandler');

    try {
      await _firebaseAuth.signOut();
    } catch (_) {
      // Best-effort — proceed even if Firebase signOut fails.
    }
    _userService.clear();
    _unreadCount.reset();
    await _secureStorage.deleteValue(StorageKeys.csrfToken);
    await _cookieJar.deleteAll();

    // Surface a transient toast BEFORE the navigation. ScaffoldMessenger
    // is global (lives above the Navigator inside MaterialApp), so the
    // toast persists across the route swap and the user sees a clean
    // "session expired" notice the moment they land on Login — matching
    // the Angular web app's `notification.showError(...)` UX.
    _showToast(reason);

    await _router.replaceAll([LoginRoute(reason: reason.remote)]);
    _loggingOut = false;
  }

  void _showToast(LogoutReason reason) {
    final context = _router.navigatorKey.currentContext;
    if (context == null || !context.mounted) return;
    if (ScaffoldMessenger.maybeOf(context) == null) return;
    MasrafyErrorToast(
      message: reason.message,
      duration: const Duration(seconds: 4),
    ).show(context);
  }
}
