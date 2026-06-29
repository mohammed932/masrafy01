import 'package:injectable/injectable.dart';

import '../../../../core/architecture/base_remote_data_source.dart';
import '../../../../core/network/api_strings.dart';
import '../../../../core/network/endpoint.dart';
import '../models/request/login/login_request.dart';
import '../models/request/login/logout_request.dart';
import '../models/request/otp/otp_request.dart';
import '../models/request/otp/otp_verify_request.dart';
import '../models/request/password/password_reset_request.dart';
import '../models/request/profile/complete_profile_request.dart';
import '../models/request/profile/profile_completion_request.dart';
import '../models/request/signup/signup_phone_complete_request.dart';
import '../models/request/signup/signup_phone_start_request.dart';
import '../models/request/signup/signup_request.dart';
import '../models/request/social/social_signin_request.dart';
import '../models/response/customer_auth_envelope_model.dart';
import '../models/response/customer_model.dart';
import '../models/response/otp_challenge_model.dart';
import '../models/response/otp_verify_outcome_model.dart';
import '../models/response/profile_upload_ticket_model.dart';
import '../models/response/social_session_model.dart';

/// Customer-auth datasource. Routes typed `*Request` DTOs to the masrafy
/// `/api/v1/auth/*` surface via `appNetwork`; `.toJson()` is called only at
/// the wire boundary. Holds both the legacy v1.7.0 endpoints and the
/// feature-008 two-path-registration endpoints (Constitution v1.8.0).
@injectable
class AuthRemoteDataSource extends BaseRemoteDataSource {
  AuthRemoteDataSource(super.appNetwork);

  Future<CustomerAuthEnvelopeModel> login(LoginRequest request) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authLogin),
      data: request.toJson(),
    );
    return CustomerAuthEnvelopeModel.fromJson(_unwrap(json));
  }

  Future<CustomerAuthEnvelopeModel> signup(SignupRequest request) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authSignup),
      data: request.toJson(),
    );
    return CustomerAuthEnvelopeModel.fromJson(_unwrap(json));
  }

  Future<CustomerModel> me() async {
    final json = await appNetwork.get(MasrafyEndpoint(endpoint: ApiStrings.authMe));
    return CustomerModel.fromJson(_unwrap(json));
  }

  Future<void> logout(LogoutRequest request) async {
    await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authLogout),
      data: request.toJson(),
    );
  }

  Future<OtpChallengeModel> signupPhoneStart(SignupPhoneStartRequest body) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authSignupPhoneStart),
      data: body.toJson(),
    );
    return OtpChallengeModel.fromJson(_unwrap(json));
  }

  Future<CustomerAuthEnvelopeModel> signupPhoneComplete(
    SignupPhoneCompleteRequest body,
  ) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authSignupPhoneComplete),
      data: body.toJson(),
    );
    return CustomerAuthEnvelopeModel.fromJson(_unwrap(json));
  }

  Future<OtpChallengeModel> otpRequest(OtpRequestRequest body) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authOtpRequest),
      data: body.toJson(),
    );
    return OtpChallengeModel.fromJson(_unwrap(json));
  }

  Future<OtpVerifyOutcomeModel> otpVerify(OtpVerifyRequest body) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authOtpVerify),
      data: body.toJson(),
    );
    return OtpVerifyOutcomeModel.fromJson(_unwrap(json));
  }

  Future<SocialSessionModel> socialGoogle(SocialGoogleSignInRequest body) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authSocialGoogle),
      data: body.toJson(),
    );
    return SocialSessionModel.fromJson(_unwrap(json));
  }

  Future<SocialSessionModel> socialApple(SocialAppleSignInRequest body) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authSocialApple),
      data: body.toJson(),
    );
    return SocialSessionModel.fromJson(_unwrap(json));
  }

  Future<CustomerAuthEnvelopeModel> socialLogin(SocialLoginRequest body) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authSocialLogin),
      data: body.toJson(),
    );
    return CustomerAuthEnvelopeModel.fromJson(_unwrap(json));
  }

  Future<OtpChallengeModel> profileMobileRequestOtp(
    ProfileMobileRequestOtpRequest body,
  ) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authProfileMobileRequestOtp),
      data: body.toJson(),
    );
    return OtpChallengeModel.fromJson(_unwrap(json));
  }

  Future<void> profileMobileVerifyOtp(ProfileMobileVerifyOtpRequest body) async {
    await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authProfileMobileVerifyOtp),
      data: body.toJson(),
    );
  }

  Future<CustomerAuthEnvelopeModel> resetPassword(PasswordResetRequest body) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authPasswordReset),
      data: body.toJson(),
    );
    return CustomerAuthEnvelopeModel.fromJson(_unwrap(json));
  }

  Future<void> changePassword(PasswordChangeRequest body) async {
    await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authPasswordChange),
      data: body.toJson(),
    );
  }

  // --- Profile completion (Principle XXXVII) ----------------------------

  Future<CustomerAuthEnvelopeModel> completeProfile(
    CompleteProfileRequest body,
  ) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authProfileComplete),
      data: body.toJson(),
    );
    return CustomerAuthEnvelopeModel.fromJson(_unwrap(json));
  }

  Future<PhotoUploadTicketModel> requestPhotoUploadUrl(
    PhotoUploadUrlRequest body,
  ) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.profilePhotoUploadUrl),
      data: body.toJson(),
    );
    return PhotoUploadTicketModel.fromJson(_unwrap(json));
  }

  Future<void> confirmPhotoUpload(PhotoConfirmRequest body) async {
    await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.profilePhotoConfirm),
      data: body.toJson(),
    );
  }

  Future<DocUploadTicketModel> requestDocUploadUrl(
    ProfileDocUploadUrlRequest body,
  ) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.profileDocUploadUrl),
      data: body.toJson(),
    );
    return DocUploadTicketModel.fromJson(_unwrap(json));
  }

  Future<void> confirmDocUpload(String documentId) async {
    await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.profileDocConfirmUpload(documentId)),
    );
  }

  /// Raw binary PUT to the presigned S3 URL (bare client; see [BaseNetwork]).
  Future<void> uploadBytes(S3UploadRequest body) async {
    await appNetwork.uploadBytes(
      body.url,
      body.bytes,
      contentType: body.contentType,
    );
  }

  Map<String, dynamic> _unwrap(dynamic envelope) {
    if (envelope is Map<String, dynamic>) {
      final data = envelope['data'];
      if (data is Map<String, dynamic>) return data;
      return envelope;
    }
    return const {};
  }
}
