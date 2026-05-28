import '../../../domain/entities/otp_challenge_entity.dart';

/// Wire-format response for `/auth/otp/request` and
/// `/auth/profile/mobile-request-otp` (feature 008).
class OtpChallengeModel {
  const OtpChallengeModel({
    required this.otpId,
    required this.maskedPhone,
    required this.expiresInSeconds,
    required this.resendAvailableInSeconds,
  });

  factory OtpChallengeModel.fromJson(Map<String, dynamic> json) {
    return OtpChallengeModel(
      otpId: json['otpId'] as String,
      maskedPhone: (json['maskedPhone'] ?? json['maskedMobile'] ?? '') as String,
      expiresInSeconds: (json['expiresInSeconds'] as num).toInt(),
      resendAvailableInSeconds: (json['resendAvailableInSeconds'] as num).toInt(),
    );
  }

  final String otpId;
  final String maskedPhone;
  final int expiresInSeconds;
  final int resendAvailableInSeconds;

  OtpChallengeEntity toEntity() => OtpChallengeEntity(
        otpId: otpId,
        maskedPhone: maskedPhone,
        expiresInSeconds: expiresInSeconds,
        resendAvailableInSeconds: resendAvailableInSeconds,
      );
}
