import '../../../domain/repositories/customer_auth_repository.dart' show OtpVerifyOutcome;

/// Wire-format response for `/auth/otp/verify` (feature 008). Discriminated:
///  - SIGNUP / MOBILE_CHANGE → returns `verifiedMobileToken` + `phone`
///  - FORGOT_PASSWORD        → returns `passwordResetToken` (PHONE customers
///                              only; SOCIAL / unknown returns same shape
///                              with no token per FR-024 no-enumeration)
class OtpVerifyOutcomeModel {
  const OtpVerifyOutcomeModel({
    this.verifiedMobileToken,
    this.passwordResetToken,
    this.phone,
    this.expiresInSeconds,
  });

  factory OtpVerifyOutcomeModel.fromJson(Map<String, dynamic> json) {
    return OtpVerifyOutcomeModel(
      verifiedMobileToken: json['verifiedMobileToken'] as String?,
      passwordResetToken: json['passwordResetToken'] as String?,
      phone: json['phone'] as String?,
      expiresInSeconds: (json['expiresInSeconds'] as num?)?.toInt(),
    );
  }

  final String? verifiedMobileToken;
  final String? passwordResetToken;
  final String? phone;
  final int? expiresInSeconds;

  OtpVerifyOutcome toEntity() => OtpVerifyOutcome(
        verifiedMobileToken: verifiedMobileToken,
        passwordResetToken: passwordResetToken,
        phone: phone,
      );
}
