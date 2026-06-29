import 'package:dartz/dartz.dart';

import '../../../../core/result/failure.dart';
import '../../data/models/request/otp/otp_request.dart';
import '../../data/models/request/otp/otp_verify_request.dart';
import '../../data/models/request/password/password_reset_request.dart';
import '../../data/models/request/profile/complete_profile_request.dart';
import '../../data/models/request/profile/profile_completion_request.dart';
import '../../data/models/request/signup/signup_phone_complete_request.dart';
import '../../data/models/request/signup/signup_phone_start_request.dart';
import '../../data/models/request/social/social_signin_request.dart';
import '../entities/customer_entity.dart';
import '../entities/otp_challenge_entity.dart';
import '../entities/social_session_entity.dart';

/// Methods with more than two parameters take a typed `*Request` DTO
/// (Principle XXX). Two-or-fewer take positional named params.
abstract class CustomerAuthRepository {
  Future<Either<Failure, OtpChallengeEntity>> signupPhoneStart(SignupPhoneStartRequest body);

  Future<Either<Failure, CustomerSessionEntity>> signupPhoneComplete(
    SignupPhoneCompleteRequest body,
  );

  Future<Either<Failure, OtpChallengeEntity>> requestOtp(OtpRequestRequest body);

  Future<Either<Failure, OtpVerifyOutcome>> verifyOtp(OtpVerifyRequest body);

  Future<Either<Failure, SocialSessionEntity>> socialGoogle(SocialGoogleSignInRequest body);

  Future<Either<Failure, SocialSessionEntity>> socialApple(SocialAppleSignInRequest body);

  Future<Either<Failure, CustomerSessionEntity>> socialLogin(SocialLoginRequest body);

  Future<Either<Failure, OtpChallengeEntity>> profileMobileRequestOtp(
    ProfileMobileRequestOtpRequest body,
  );

  Future<Either<Failure, void>> profileMobileVerifyOtp(ProfileMobileVerifyOtpRequest body);

  Future<Either<Failure, CustomerSessionEntity>> resetPassword(PasswordResetRequest body);

  Future<Either<Failure, void>> changePassword(PasswordChangeRequest body);

  // --- Profile completion (Principle XXXVII) ---

  /// Uploads the profile photo: presign → S3 PUT → confirm (one transaction
  /// from the caller's view).
  Future<Either<Failure, Unit>> uploadProfilePhoto(UploadAssetRequest body);

  /// Uploads one National ID side: presign → S3 PUT → confirm.
  Future<Either<Failure, Unit>> uploadNationalIdSide(UploadNationalIdRequest body);

  /// Submits the scalar profile fields; returns the refreshed session.
  Future<Either<Failure, CustomerSessionEntity>> completeProfile(
    CompleteProfileRequest body,
  );
}

/// Discriminated outcome of `verifyOtp`. SIGNUP/MOBILE_CHANGE → `verifiedMobileToken`;
/// FORGOT_PASSWORD → `passwordResetToken` (null for SOCIAL/unknown per FR-024).
class OtpVerifyOutcome {
  const OtpVerifyOutcome({this.verifiedMobileToken, this.passwordResetToken, this.phone});
  final String? verifiedMobileToken;
  final String? passwordResetToken;
  final String? phone;
}
