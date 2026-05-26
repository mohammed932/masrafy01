/// Why the user was forcibly signed out. Mirrors the remote reasons used
/// by Angular's `forceLogout(...)` helper so push notifications, deep
/// links, and the login banner stay aligned across platforms.
///
/// See `frontend/src/app/core/interceptors/auth-error.interceptor.ts`.
enum LogoutReason {
  /// Generic — server rejected the session without a more specific cause.
  sessionExpired('session-expired'),

  /// Same account signed in elsewhere; the prior device was kicked.
  anotherDevice('another-device'),

  /// Session token revoked server-side (security event).
  sessionInvalidated('session-invalidated'),

  /// Access token revoked.
  tokenRevoked('token-revoked');

  const LogoutReason(this.remote);

  /// Stable string used in route query params + push payloads.
  final String remote;

  static LogoutReason? fromRemote(String? remote) {
    if (remote == null || remote.isEmpty) return null;
    for (final r in LogoutReason.values) {
      if (r.remote == remote) return r;
    }
    return null;
  }

  String get title => switch (this) {
        LogoutReason.sessionExpired => 'Session Expired',
        LogoutReason.anotherDevice => 'Signed Out',
        LogoutReason.sessionInvalidated => 'Security Notice',
        LogoutReason.tokenRevoked => 'Access Revoked',
      };

  String get message => switch (this) {
        LogoutReason.sessionExpired =>
          'Your session has expired. Please sign in again to continue.',
        LogoutReason.anotherDevice =>
          'You were signed out because your account was accessed from another device.',
        LogoutReason.sessionInvalidated =>
          'Your session was invalidated for security reasons.',
        LogoutReason.tokenRevoked =>
          'Your access token was revoked. Please sign in again.',
      };
}
