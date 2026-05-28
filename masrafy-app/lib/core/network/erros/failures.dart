import 'package:equatable/equatable.dart';

class Failure extends Equatable {
  final String message;
  const Failure({required this.message});

  @override
  List<Object?> get props => [message];

  @override
  String toString() => message;
}

class ServerFailure extends Failure {
  const ServerFailure({required super.message});
}

class FetchDataFailure extends Failure {
  const FetchDataFailure({required super.message});
}

class UnauthorizedFailure extends Failure {
  const UnauthorizedFailure({required super.message});
}

class NoInternetConnectionFailure extends Failure {
  const NoInternetConnectionFailure({required super.message});
}

/// Emitted when the password reset action code is invalid, expired, or already used (FR-050).
class InvalidActionCodeFailure extends Failure {
  const InvalidActionCodeFailure({required super.message});
}

// --- Auth-specific failures (primitive fields — cubit converts to rich types) ---

class ForbiddenFailure extends Failure {
  const ForbiddenFailure({required super.message});
}

class AuthFailure extends Failure {
  const AuthFailure._({required super.message});

  factory AuthFailure.invalidCredentials() =>
      const AuthFailure._(message: 'Invalid credentials');

  factory AuthFailure.emailNotVerified() =>
      const AuthFailure._(message: 'Email not verified');

  factory AuthFailure.accountDisabled() =>
      const AuthFailure._(message: 'Account disabled');

  factory AuthFailure.accountBanned() =>
      const AuthFailure._(message: 'Account banned');

  factory AuthFailure.activeSessionExists({
    required Map<String, dynamic> sessionInfo,
  }) => _ActiveSessionExistsFailure(sessionInfo: sessionInfo);

  factory AuthFailure.profileCompletionRequired() =>
      const AuthFailure._(message: 'Profile completion required');

  factory AuthFailure.cancelled() =>
      const AuthFailure._(message: 'Cancelled');

  factory AuthFailure.rateLimited({Duration? retryAfter}) =>
      _RateLimitedFailure(retryAfter: retryAfter);

  factory AuthFailure.forbidden() =>
      const AuthFailure._(message: 'Forbidden');

  factory AuthFailure.unknown(String userMessage) =>
      AuthFailure._(message: userMessage);
}

class _ActiveSessionExistsFailure extends AuthFailure {
  final Map<String, dynamic> sessionInfo;
  const _ActiveSessionExistsFailure({required this.sessionInfo})
      : super._(message: 'Active session exists on another device');

  @override
  List<Object?> get props => [message, sessionInfo];
}

class _RateLimitedFailure extends AuthFailure {
  final Duration? retryAfter;
  const _RateLimitedFailure({this.retryAfter})
      : super._(message: 'Too many attempts');

  @override
  List<Object?> get props => [message, retryAfter];
}

// ── E-Shop failures (011) ────────────────────────────────────────────────────

/// Raised when POST /payment/create-checkout-session fails at the HTTP layer.
class StripeSessionFailure extends Failure {
  const StripeSessionFailure({required super.message});

  @override
  List<Object?> get props => [message];

  @override
  String toString() => 'StripeSessionFailure($message)';
}

/// Raised by the repository when the coupon-validate endpoint returns valid:false.
/// Carries the backend-provided message (or a default when absent).
class CouponInvalidFailure extends Failure {
  const CouponInvalidFailure({required super.message});

  @override
  List<Object?> get props => [message];

  @override
  String toString() => 'CouponInvalidFailure($message)';
}

extension AuthFailureTypeCheck on AuthFailure {
  bool get isInvalidCredentials =>
      message == 'Invalid credentials' && this is! _ActiveSessionExistsFailure;
  bool get isEmailNotVerified => message == 'Email not verified';
  bool get isAccountDisabled => message == 'Account disabled';
  bool get isAccountBanned => message == 'Account banned';
  bool get isActiveSessionExists => this is _ActiveSessionExistsFailure;
  bool get isProfileCompletionRequired => message == 'Profile completion required';
  bool get isCancelled => message == 'Cancelled';
  bool get isRateLimited => this is _RateLimitedFailure;
  bool get isForbidden => message == 'Forbidden';

  Map<String, dynamic>? get activeSessionInfo {
    final f = this;
    return f is _ActiveSessionExistsFailure ? f.sessionInfo : null;
  }

  Duration? get retryAfter {
    final f = this;
    return f is _RateLimitedFailure ? f.retryAfter : null;
  }
}
