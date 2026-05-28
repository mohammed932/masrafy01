import 'failures.dart';

/// Returns true when [failure] is a 403 triggered by a trial/subscription
/// limit — the cubit should show an upgrade modal instead of a generic toast.
bool isTrialLock(Failure failure) {
  if (failure is! ForbiddenFailure) return false;
  final msg = failure.message.toLowerCase();
  return msg.contains('subscription') ||
      msg.contains('trial') ||
      msg.contains('upgrade') ||
      msg.contains('feature is not available');
}

/// Default user-facing message for a [Failure]. Plain, non-technical, no
/// status codes / stack traces / exception names — per spec FR-016.
///
/// Cubits can consume this directly, or override at call-site when the
/// surface needs feature-specific phrasing (e.g. "We couldn't save your
/// profile" vs "We couldn't sign you in").
extension FailureUserMessageX on Failure {
  String get userFacingMessage {
    final f = this;
    if (f is NoInternetConnectionFailure) {
      return 'No internet connection. Check your network and try again.';
    }
    if (f is InvalidActionCodeFailure) {
      return 'This reset link is no longer valid. Request a new one to continue.';
    }
    if (f is StripeSessionFailure) {
      return "We couldn't start your checkout. Please try again or contact support.";
    }
    if (f is CouponInvalidFailure) {
      return f.message.isNotEmpty
          ? f.message
          : 'This coupon code is invalid or has expired.';
    }
    if (f is ServerFailure) {
      return 'Something went wrong on our end. Please try again shortly.';
    }
    if (f is AuthFailure) {
      if (f.isInvalidCredentials) return 'Email or password is incorrect.';
      if (f.isEmailNotVerified) return 'Please verify your email to continue.';
      if (f.isAccountDisabled) {
        return 'This account is disabled. Please contact support.';
      }
      if (f.isAccountBanned) {
        return 'This account has been banned. Please contact support.';
      }
      if (f.isRateLimited) {
        return 'Too many attempts. Please try again in a few minutes.';
      }
      if (f.isForbidden) return "You don't have permission to do that.";
      if (f.isCancelled) return 'Cancelled.';
      if (f.isProfileCompletionRequired) {
        return 'Please complete your profile to continue.';
      }
    }
    return message.isNotEmpty
        ? message
        : 'Something went wrong. Please try again.';
  }

  /// True when the server rejected the request because the user has reached
  /// their plan limit (409 or "limit" in the raw message).
  bool get isPlanLimit {
    final msg = message.toLowerCase();
    return msg.contains('limit') || msg.contains('409');
  }
}
