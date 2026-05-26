part of 'portal_auth_handshake_cubit.dart';

/// Lifecycle stages the auth handshake moves through.
enum PortalLifecycle {
  /// Cubit created; nothing happening yet.
  idle,

  /// WebView is loading the hosted URL.
  loadingPage,

  /// Hosted page finished loading; Flutter has posted AUTH_TOKEN and is
  /// waiting for either AUTH_READY or AUTH_REQUIRED.
  sendingToken,

  /// Hosted page reported it is rendering. Loading overlay can fade out.
  ready,

  /// Terminal failure state — see [PortalAuthHandshakeState.failure].
  failed,
}

/// Sealed union of the auth-failure reasons the hosted page can surface.
/// Backend wire strings map to variants via [PortalAuthFailure.fromReason].
@freezed
class PortalAuthFailure with _$PortalAuthFailure {
  const factory PortalAuthFailure.tokenExpired() = _PortalAuthTokenExpired;
  const factory PortalAuthFailure.tokenRevoked() = _PortalAuthTokenRevoked;
  const factory PortalAuthFailure.userDisabled() = _PortalAuthUserDisabled;
  const factory PortalAuthFailure.userNotFound() = _PortalAuthUserNotFound;
  const factory PortalAuthFailure.invalidToken() = _PortalAuthInvalidToken;
  const factory PortalAuthFailure.rateLimited({DateTime? resetAt}) =
      _PortalAuthRateLimited;
  const factory PortalAuthFailure.networkError() = _PortalAuthNetworkError;
  const factory PortalAuthFailure.attachmentNotFound() =
      _PortalAuthAttachmentNotFound;
  const factory PortalAuthFailure.unknown(String? raw) = _PortalAuthUnknown;

  /// Maps the backend's `reason` string to a typed variant. Unknown / missing
  /// strings fall through to [PortalAuthFailure.unknown].
  static PortalAuthFailure fromReason(String? reason, {DateTime? resetAt}) {
    switch (reason) {
      case 'token_expired':
        return const PortalAuthFailure.tokenExpired();
      case 'token_revoked':
        return const PortalAuthFailure.tokenRevoked();
      case 'user_disabled':
        return const PortalAuthFailure.userDisabled();
      case 'user_not_found':
        return const PortalAuthFailure.userNotFound();
      case 'invalid_token':
        return const PortalAuthFailure.invalidToken();
      case 'rate_limited':
        return PortalAuthFailure.rateLimited(resetAt: resetAt);
      case 'not_found':
        return const PortalAuthFailure.attachmentNotFound();
      default:
        return PortalAuthFailure.unknown(reason);
    }
  }
}

/// Cubit state for [PortalAuthHandshakeCubit].
@freezed
class PortalAuthHandshakeState with _$PortalAuthHandshakeState {
  const factory PortalAuthHandshakeState({
    @Default(PortalLifecycle.idle) PortalLifecycle status,
    PortalAuthFailure? failure,
    @Default(false) bool pageReady,
    @Default(0) int retryCount,
  }) = _PortalAuthHandshakeState;

  // ignore: unused_element
  const PortalAuthHandshakeState._();

  bool get isLoading =>
      status == PortalLifecycle.loadingPage ||
      status == PortalLifecycle.sendingToken;

  bool get isReady => status == PortalLifecycle.ready;

  bool get isFailed => status == PortalLifecycle.failed;
}
