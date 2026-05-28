import '../../../../domain/enums/otp_purpose.dart';

class OtpVerifyRequest {
  const OtpVerifyRequest({
    required this.otpId,
    required this.code,
    required this.purpose,
  });

  final String otpId;
  final String code;
  final OtpPurpose purpose;

  Map<String, dynamic> toJson() => {
        'otpId': otpId,
        'code': code,
        'purpose': purpose.wireName,
      };
}
