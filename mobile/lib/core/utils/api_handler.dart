import 'dart:async';
import 'dart:developer';

import 'package:dartz/dartz.dart';

import '../injection/injection.dart';
import '../network/erros/exceptions.dart';
import '../network/erros/failures.dart';
import '../services/auth/session_expiration_handler.dart';

/// Returns a `Future` that never completes. Used to silence the
/// in-flight request whose 401 just kicked off a force-logout — the
/// awaiting cubit hangs harmlessly until the router replaces its
/// screen with Login, at which point the cubit is disposed and the
/// pending future is GC'd. Prevents the brief "Unauthorized" flash
/// behind the login screen.
Future<Either<Failure, T>> _silentlyHang<T>() => Completer<Either<Failure, T>>().future;

class ApiHandler {
  /// Generic API wrapper — converts AppException → Failure.
  ///
  /// Endpoint-specific failure mapping (e.g. StripeSessionFailure for
  /// POST /payment/create-checkout-session) is done at the repository layer:
  /// call `callApi(...)` then fold and convert ServerFailure → the specific
  /// subtype. CouponInvalidFailure is raised directly in the repository when
  /// the response body contains `valid: false` (HTTP 200, not an exception).
  ///
  /// Session-expiry path: when an in-flight request gets a session-fatal
  /// 401, `AuthErrorInterceptor` fires `forceLogout` and the resulting
  /// `UnauthorizedException` lands here. We check
  /// `SessionExpirationHandler.isLoggingOut` on every catch and, if a
  /// logout is in progress, return a never-completing future so the
  /// cubit can't emit an error state behind the navigation.
  static Future<Either<Failure, T>> callApi<T>(
    Future<T> Function() call,
  ) async {
    try {
      return Right(await call());
    } on InvalidActionCodeException catch (e) {
      return Left(InvalidActionCodeFailure(message: e.msg ?? ''));
    } on ConnectivityException catch (e) {
      return Left(NoInternetConnectionFailure(message: e.msg ?? ''));
    } on ServerException catch (e) {
      if (_isLoggingOut) return _silentlyHang<T>();
      return Left(ServerFailure(message: e.msg ?? ''));
    } on InvalidCredentialsException {
      return Left(AuthFailure.invalidCredentials());
    } on EmailNotVerifiedException {
      return Left(AuthFailure.emailNotVerified());
    } on AccountDisabledException {
      return Left(AuthFailure.accountDisabled());
    } on AccountBannedException {
      return Left(AuthFailure.accountBanned());
    } on ActiveSessionExistsException catch (e) {
      return Left(
        AuthFailure.activeSessionExists(sessionInfo: e.sessionInfo),
      );
    } on ProfileCompletionRequiredException {
      return Left(AuthFailure.profileCompletionRequired());
    } on GoogleSignInCancelledException {
      return Left(AuthFailure.cancelled());
    } on FirebaseAuthException {
      return Left(AuthFailure.invalidCredentials());
    } on BadRequestException catch (e) {
      return Left(FetchDataFailure(message: e.msg ?? ''));
    } on RateLimitedException catch (e) {
      return Left(AuthFailure.rateLimited(retryAfter: e.retryAfter));
    } on UnauthorizedException catch (e) {
      // Always hang on 401 — by this point AuthErrorInterceptor has
      // already kicked off forceLogout (or will once the resolver
      // resolves), so the user is mid-navigation to Login.
      if (_isLoggingOut) return _silentlyHang<T>();
      return Left(UnauthorizedFailure(message: e.msg ?? ''));
    } on ForbiddenException {
      if (_isLoggingOut) return _silentlyHang<T>();
      return Left(AuthFailure.forbidden());
    } catch (e) {
      if (_isLoggingOut) return _silentlyHang<T>();
      log('callApi error at $T: $e');
      return Left(FetchDataFailure(message: e.toString()));
    }
  }

  /// True iff a force-logout is mid-flight. Resolves from DI lazily so
  /// `ApiHandler` (used at startup before all singletons are wired)
  /// stays constructable. Tolerates the rare case where the handler
  /// hasn't been registered yet (e.g. unit tests) by returning false.
  static bool get _isLoggingOut {
    if (!getIt.isRegistered<SessionExpirationHandler>()) return false;
    return getIt<SessionExpirationHandler>().isLoggingOut;
  }
}
