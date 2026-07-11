import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/result/failure.dart';
import 'package:app/core/utils/api_handler.dart';
import 'package:app/features/auth/data/datasources/auth_remote_datasource.dart';
import 'package:app/features/auth/data/models/request/otp/otp_request.dart';
import 'package:app/features/auth/data/models/request/otp/otp_verify_request.dart';
import 'package:app/features/auth/data/models/request/password/password_reset_request.dart';
import 'package:app/features/auth/data/models/request/profile/complete_profile_request.dart';
import 'package:app/features/auth/data/models/request/profile/profile_completion_request.dart';
import 'package:app/features/auth/data/models/request/signup/signup_phone_verify_request.dart';
import 'package:app/features/auth/data/models/request/signup/signup_phone_start_request.dart';
import 'package:app/features/auth/data/models/request/social/social_signin_request.dart';
import 'package:app/features/auth/domain/entities/customer_entity.dart';
import 'package:app/features/auth/domain/entities/otp_challenge_entity.dart';
import 'package:app/features/auth/domain/entities/profile_documents_status_entity.dart';
import 'package:app/features/auth/domain/entities/social_session_entity.dart';
import 'package:app/features/auth/domain/repositories/customer_auth_repository.dart';

/// Thin network-mapping forwarder for [CustomerAuthRepository] (Constitution
/// Principles X + XXX). Mirrors [AuthRepositoryImpl]: every call routes through
/// [ApiHandler.callApi] and maps the wire `Model` to its domain entity. The
/// secure-storage session save lives in [CustomerAuthUseCase], not here, so the
/// repo stays a pure forwarder.
///
/// The interface is a plain abstract class (no [BaseRepository]), so the
/// datasource is injected directly. Registered manually in `injection.dart`;
/// the annotation mirrors the codebase convention.
@Injectable(as: CustomerAuthRepository)
class CustomerAuthRepositoryImpl implements CustomerAuthRepository {
  CustomerAuthRepositoryImpl(this._ds);

  final AuthRemoteDataSource _ds;

  @override
  Future<Either<Failure, OtpChallengeEntity>> signupPhoneStart(
    SignupPhoneStartRequest body,
  ) async {
    final result = await ApiHandler.callApi(() => _ds.signupPhoneStart(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, CustomerSessionEntity>> signupPhoneVerify(
    SignupPhoneVerifyRequest body,
  ) async {
    final result = await ApiHandler.callApi(() => _ds.signupPhoneVerify(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, OtpChallengeEntity>> requestOtp(OtpRequestRequest body) async {
    final result = await ApiHandler.callApi(() => _ds.otpRequest(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, OtpVerifyOutcome>> verifyOtp(OtpVerifyRequest body) async {
    final result = await ApiHandler.callApi(() => _ds.otpVerify(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, SocialSessionEntity>> socialGoogle(
    SocialGoogleSignInRequest body,
  ) async {
    final result = await ApiHandler.callApi(() => _ds.socialGoogle(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, SocialSessionEntity>> socialApple(
    SocialAppleSignInRequest body,
  ) async {
    final result = await ApiHandler.callApi(() => _ds.socialApple(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, CustomerSessionEntity>> socialLogin(SocialLoginRequest body) async {
    final result = await ApiHandler.callApi(() => _ds.socialLogin(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, OtpChallengeEntity>> profileMobileRequestOtp(
    ProfileMobileRequestOtpRequest body,
  ) async {
    final result = await ApiHandler.callApi(() => _ds.profileMobileRequestOtp(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, void>> profileMobileVerifyOtp(
    ProfileMobileVerifyOtpRequest body,
  ) {
    return ApiHandler.callApi(() => _ds.profileMobileVerifyOtp(body));
  }

  @override
  Future<Either<Failure, CustomerSessionEntity>> resetPassword(PasswordResetRequest body) async {
    final result = await ApiHandler.callApi(() => _ds.resetPassword(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, void>> changePassword(PasswordChangeRequest body) {
    return ApiHandler.callApi(() => _ds.changePassword(body));
  }

  @override
  Future<Either<Failure, Unit>> uploadProfilePhoto(UploadAssetRequest body) {
    return ApiHandler.callApi(() async {
      final ticket = await _ds.requestPhotoUploadUrl(
        PhotoUploadUrlRequest(
          mimeType: body.contentType,
          sizeBytes: body.bytes.length,
        ),
      );
      await _ds.uploadBytes(
        S3UploadRequest(
          url: ticket.uploadUrl,
          bytes: body.bytes,
          contentType: body.contentType,
        ),
      );
      await _ds.confirmPhotoUpload(PhotoConfirmRequest(s3Key: ticket.s3Key));
      return unit;
    });
  }

  @override
  Future<Either<Failure, Unit>> uploadNationalIdSide(
    UploadNationalIdRequest body,
  ) {
    return ApiHandler.callApi(() async {
      final ticket = await _ds.requestDocUploadUrl(
        ProfileDocUploadUrlRequest(
          documentType: body.documentType,
          mimeType: body.contentType,
          sizeBytes: body.bytes.length,
          originalFilename: body.filename,
        ),
      );
      await _ds.uploadBytes(
        S3UploadRequest(
          url: ticket.uploadUrl,
          bytes: body.bytes,
          contentType: body.contentType,
        ),
      );
      await _ds.confirmDocUpload(ticket.documentId);
      return unit;
    });
  }

  @override
  Future<Either<Failure, CustomerSessionEntity>> completeProfile(
    CompleteProfileRequest body,
  ) async {
    final result = await ApiHandler.callApi(() => _ds.completeProfile(body));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, ProfileDocumentsStatusEntity>>
      profileDocumentsStatus() async {
    final result =
        await ApiHandler.callApi(() => _ds.profileDocumentsStatus());
    return result.map((m) => m.toEntity());
  }
}
