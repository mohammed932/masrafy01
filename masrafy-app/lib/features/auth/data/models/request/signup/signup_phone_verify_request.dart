/// `POST /api/v1/auth/signup/phone/verify`. Consumes the OTP-issued
/// `verifiedMobileToken` and creates the LITE customer account (Principle XIII,
/// lite-row model). The profile fields (name, birthday, email, password, photo,
/// National ID) are submitted afterwards on the mandatory Complete-Profile step.
class SignupPhoneVerifyRequest {
  const SignupPhoneVerifyRequest({
    required this.verifiedMobileToken,
    this.locale,
  });

  final String verifiedMobileToken;

  /// Optional `ar-EG` / `en-US`. Omitted → backend defaults to `ar-EG`.
  final String? locale;

  Map<String, dynamic> toJson() => {
        'verifiedMobileToken': verifiedMobileToken,
        if (locale != null && locale!.isNotEmpty) 'locale': locale,
      };
}
