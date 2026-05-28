abstract class AppException implements Exception {
  final String? msg;
  const AppException([this.msg]);
}

// --- Generic (mirror NestJS HTTP exception names) ---

class ServerException implements AppException {
  const ServerException([this.msg = 'Server error']);
  @override
  final String? msg;
}

class UnauthorizedException implements AppException {
  const UnauthorizedException([this.msg = 'Unauthorized']);
  @override
  final String? msg;
}

class ForbiddenException implements AppException {
  const ForbiddenException([this.msg = 'Forbidden']);
  @override
  final String? msg;
}

class NotFoundException implements AppException {
  const NotFoundException([this.msg = 'Not found']);
  @override
  final String? msg;
}

class BadRequestException implements AppException {
  const BadRequestException([this.msg = 'Bad request']);
  @override
  final String? msg;
}

class ConnectivityException implements AppException {
  const ConnectivityException([this.msg = 'No internet connection']);
  @override
  final String? msg;
}

class UnCaughtException implements AppException {
  const UnCaughtException([this.msg = 'Something went wrong']);
  @override
  final String? msg;
}

// --- Auth-specific (names mirror Angular's AuthErrorCode enum) ---

/// Mirrors `AuthErrorCode.INVALID_CREDENTIALS`.
class InvalidCredentialsException implements AppException {
  const InvalidCredentialsException([this.msg = 'Invalid credentials']);
  @override
  final String? msg;
}

/// Mirrors `AuthErrorCode.EMAIL_NOT_VERIFIED`.
class EmailNotVerifiedException implements AppException {
  const EmailNotVerifiedException([this.msg = 'Email not verified']);
  @override
  final String? msg;
}

/// Mirrors `AuthErrorCode.ACCOUNT_DISABLED`.
class AccountDisabledException implements AppException {
  const AccountDisabledException([this.msg = 'Account disabled']);
  @override
  final String? msg;
}

/// Mirrors `AuthErrorCode.ACCOUNT_BANNED`.
class AccountBannedException implements AppException {
  const AccountBannedException([this.msg = 'Account banned']);
  @override
  final String? msg;
}

/// Mirrors backend response code `ACTIVE_SESSION_EXISTS`. `sessionInfo` is
/// the raw map from the backend — converted to `SessionInfoModel` at the
/// feature layer to keep core layer-agnostic.
class ActiveSessionExistsException implements AppException {
  final Map<String, dynamic> sessionInfo;
  const ActiveSessionExistsException({required this.sessionInfo});
  @override
  String? get msg => null;
}

class ProfileCompletionRequiredException implements AppException {
  const ProfileCompletionRequiredException();
  @override
  String? get msg => null;
}

class RateLimitedException implements AppException {
  final Duration? retryAfter;
  const RateLimitedException({this.retryAfter, this.msg});
  @override
  final String? msg;
}

// --- Firebase / Google client-side ---

class FirebaseAuthException implements AppException {
  final String code;
  final String rawMessage;
  const FirebaseAuthException({
    required this.code,
    required this.rawMessage,
  });
  @override
  String? get msg => rawMessage;
}

class GoogleSignInCancelledException implements AppException {
  const GoogleSignInCancelledException();
  @override
  String? get msg => null;
}

/// Thrown when the password reset action code is invalid, expired, or already used.
class InvalidActionCodeException implements AppException {
  const InvalidActionCodeException([this.msg = 'Invalid or expired reset code']);
  @override
  final String? msg;
}

// --- String code constants (mirror Angular `AuthErrorCode` verbatim) ---

abstract class AuthErrorCode {
  AuthErrorCode._();
  static const String emailNotVerified = 'EMAIL_NOT_VERIFIED';
  static const String accountDisabled = 'ACCOUNT_DISABLED';
  static const String accountBanned = 'ACCOUNT_BANNED';
  static const String invalidCredentials = 'INVALID_CREDENTIALS';
  static const String activeSessionExists = 'ACTIVE_SESSION_EXISTS';
  static const String insufficientPermissions = 'INSUFFICIENT_PERMISSIONS';
  static const String invalidActionCode = 'INVALID_ACTION_CODE';
}
