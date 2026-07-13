import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/result/failure.dart';
import '../../../../core/storage/customer_session_storage.dart';
import '../../data/models/request/otp/otp_request.dart';
import '../../data/models/request/otp/otp_verify_request.dart';
import '../../data/models/request/password/password_reset_request.dart';
import '../../data/models/request/profile/complete_profile_request.dart';
import '../../data/models/request/signup/signup_phone_verify_request.dart';
import '../../data/models/request/signup/signup_phone_start_request.dart';
import '../../data/models/request/social/social_signin_request.dart';
import '../entities/customer_entity.dart';
import '../entities/otp_challenge_entity.dart';
import '../entities/profile_documents_status_entity.dart';
import '../repositories/customer_auth_repository.dart';

/// Orchestrates the PHONE two-path registration (Principle XIII): start →
/// OTP verify → complete. Plain class (the repository is a flat interface, not
/// a [BaseRepository]); mirrors [AuthUseCase] in that the secure-storage
/// side-effect on a fresh session lives here, NOT in the repository, so the
/// repo stays a pure network-mapping forwarder.
@injectable
class CustomerAuthUseCase {
  CustomerAuthUseCase(this._repo, this._session);

  final CustomerAuthRepository _repo;
  final CustomerSessionStorage _session;

  Future<Either<Failure, OtpChallengeEntity>> signupPhoneStart(
    SignupPhoneStartRequest request,
  ) =>
      _repo.signupPhoneStart(request);

  Future<Either<Failure, OtpChallengeEntity>> requestOtp(OtpRequestRequest request) =>
      _repo.requestOtp(request);

  Future<Either<Failure, OtpVerifyOutcome>> verifyOtp(OtpVerifyRequest request) =>
      _repo.verifyOtp(request);

  Future<Either<Failure, CustomerSessionEntity>> signupPhoneVerify(
    SignupPhoneVerifyRequest request,
  ) async {
    final result = await _repo.signupPhoneVerify(request);
    await result.fold(
      (_) async {},
      (session) => _session.save(
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        customerId: session.customer.id,
      ),
    );
    return result;
  }

  /// SOCIAL sign-in (Google). Verifies the ID token server-side, then:
  /// - new customer → the backend issued tokens inline (`newCustomerSession`);
  /// - existing customer → exchange the short-lived `socialSessionId` for
  ///   tokens via `/social/login`.
  /// Either way the fresh session is persisted to secure storage here (same
  /// side-effect convention as [signupPhoneVerify]) so the repo stays a pure
  /// forwarder.
  Future<Either<Failure, CustomerSessionEntity>> signInWithGoogle(
    SocialGoogleSignInRequest request,
  ) async {
    final social = await _repo.socialGoogle(request);
    return social.fold<Future<Either<Failure, CustomerSessionEntity>>>(
      (f) async => Left(f),
      (s) async {
        // New lite-SOCIAL customer: tokens issued inline, no second call.
        final fresh = s.newCustomerSession;
        if (fresh != null) {
          await _session.save(
            accessToken: fresh.accessToken,
            refreshToken: fresh.refreshToken,
            customerId: fresh.customer.id,
          );
          return Right(fresh);
        }
        // Returning customer: exchange the social session for tokens.
        final sid = s.socialSessionId;
        if (sid != null) {
          final login =
              await _repo.socialLogin(SocialLoginRequest(socialSessionId: sid));
          await login.fold(
            (_) async {},
            (session) => _session.save(
              accessToken: session.accessToken,
              refreshToken: session.refreshToken,
              customerId: session.customer.id,
            ),
          );
          return login;
        }
        // Neither branch present — treat as an invalid social response.
        return const Left(ServerFailure(code: 'SOCIAL_TOKEN_INVALID'));
      },
    );
  }

  // --- Profile completion (Principle XXXVII) ---

  Future<Either<Failure, Unit>> uploadProfilePhoto(UploadAssetRequest request) =>
      _repo.uploadProfilePhoto(request);

  Future<Either<Failure, Unit>> uploadNationalIdSide(
    UploadNationalIdRequest request,
  ) =>
      _repo.uploadNationalIdSide(request);

  Future<Either<Failure, CustomerSessionEntity>> completeProfile(
    CompleteProfileRequest request,
  ) async {
    final result = await _repo.completeProfile(request);
    await result.fold(
      (_) async {},
      (session) => _session.save(
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        customerId: session.customer.id,
      ),
    );
    return result;
  }

  Future<Either<Failure, ProfileDocumentsStatusEntity>>
      profileDocumentsStatus() =>
          _repo.profileDocumentsStatus();

  /// Changes the authenticated customer's password. The backend revokes ALL
  /// sessions on success and returns no new tokens, so the local session is
  /// cleared here — the caller must route the user back to Login.
  Future<Either<Failure, Unit>> changePassword(
    PasswordChangeRequest request,
  ) async {
    final result = await _repo.changePassword(request);
    await result.fold((_) async {}, (_) => _session.clear());
    return result.map((_) => unit);
  }
}
