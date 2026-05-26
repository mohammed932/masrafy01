import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/result/failure.dart';
import '../../../../core/utils/api_handler.dart';
import '../../domain/entities/customer_entity.dart';
import '../../domain/entities/otp_challenge_entity.dart';
import '../../domain/entities/social_session_entity.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../domain/repositories/customer_auth_repository.dart';
import '../models/request/login/login_request.dart';
import '../models/request/login/logout_request.dart';
import '../models/request/otp/otp_request.dart';
import '../models/request/otp/otp_verify_request.dart';
import '../models/request/password/password_reset_request.dart';
import '../models/request/profile/profile_completion_request.dart';
import '../models/request/signup/signup_phone_complete_request.dart';
import '../models/request/signup/signup_phone_start_request.dart';
import '../models/request/signup/signup_request.dart';
import '../models/request/social/social_signin_request.dart';

/// Implements both [AuthRepository] (legacy v1.7.0) and
/// [CustomerAuthRepository] (feature 008). One-liner methods routed through
/// `ApiHandler.callApi` per Constitution Principle XXX. The second
/// interface is bound manually in `core/di/injection.dart`.
@Injectable(as: AuthRepository)
class AuthRepositoryImpl extends AuthRepository implements CustomerAuthRepository {
  AuthRepositoryImpl(super.remoteDataSource);

  @override
  Future<Either<Failure, CustomerSessionEntity>> login(LoginRequest request) async {
    final result = await ApiHandler.callApi(() => remoteDataSource.login(request));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, CustomerSessionEntity>> signup(SignupRequest request) async {
    final result = await ApiHandler.callApi(() => remoteDataSource.signup(request));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, CustomerEntity>> me() async {
    final result = await ApiHandler.callApi(() => remoteDataSource.me());
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, Unit>> logout(LogoutRequest request) async {
    // Best-effort: local cleanup in usecase is authoritative.
    try {
      await remoteDataSource.logout(request);
    } catch (_) {/* swallow */}
    return const Right(unit);
  }

  @override
  Future<Either<Failure, OtpChallengeEntity>> signupPhoneStart(SignupPhoneStartRequest body) async {
    final result = await ApiHandler.callApi(() => remoteDataSource.signupPhoneStart(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, CustomerSessionEntity>> signupPhoneComplete(
    SignupPhoneCompleteRequest body,
  ) async {
    final result = await ApiHandler.callApi(() => remoteDataSource.signupPhoneComplete(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, OtpChallengeEntity>> requestOtp(OtpRequestRequest body) async {
    final result = await ApiHandler.callApi(() => remoteDataSource.otpRequest(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, OtpVerifyOutcome>> verifyOtp(OtpVerifyRequest body) async {
    final result = await ApiHandler.callApi(() => remoteDataSource.otpVerify(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, SocialSessionEntity>> socialGoogle(SocialGoogleSignInRequest body) async {
    final result = await ApiHandler.callApi(() => remoteDataSource.socialGoogle(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, SocialSessionEntity>> socialApple(SocialAppleSignInRequest body) async {
    final result = await ApiHandler.callApi(() => remoteDataSource.socialApple(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, CustomerSessionEntity>> socialLogin(SocialLoginRequest body) async {
    final result = await ApiHandler.callApi(() => remoteDataSource.socialLogin(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, OtpChallengeEntity>> profileMobileRequestOtp(
    ProfileMobileRequestOtpRequest body,
  ) async {
    final result = await ApiHandler.callApi(
      () => remoteDataSource.profileMobileRequestOtp(body),
    );
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, void>> profileMobileVerifyOtp(ProfileMobileVerifyOtpRequest body) =>
      ApiHandler.callApi(() => remoteDataSource.profileMobileVerifyOtp(body));

  @override
  Future<Either<Failure, CustomerSessionEntity>> resetPassword(PasswordResetRequest body) async {
    final result = await ApiHandler.callApi(() => remoteDataSource.resetPassword(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, void>> changePassword(PasswordChangeRequest body) =>
      ApiHandler.callApi(() => remoteDataSource.changePassword(body));
}
