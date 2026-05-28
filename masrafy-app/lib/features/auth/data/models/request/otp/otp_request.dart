import '../../../../domain/enums/otp_purpose.dart';

/// Wire payload for `POST /api/v1/auth/otp/request` (feature 008).
/// `purpose` is the domain enum; converted to the wire-format string in
/// [toJson]. `LOGIN` is rejected by the backend (FR-017) and is intentionally
/// absent from [OtpPurpose].
class OtpRequestRequest {
  const OtpRequestRequest({
    required this.phone,
    required this.purpose,
    required this.locale,
  });

  final String phone;
  final OtpPurpose purpose;
  final String locale;

  Map<String, dynamic> toJson() => {
        'phone': phone,
        'purpose': purpose.wireName,
        'locale': locale,
      };
}
