/// OTP issuance purpose — spec FR-016. LOGIN is intentionally NOT included
/// (the backend rejects it per FR-017 with the canary alarm).
enum OtpPurpose { signup, profileMobile, forgotPassword, mobileChange }

extension OtpPurposeWireName on OtpPurpose {
  String get wireName {
    switch (this) {
      case OtpPurpose.signup:
        return 'SIGNUP';
      case OtpPurpose.profileMobile:
        return 'PROFILE_MOBILE';
      case OtpPurpose.forgotPassword:
        return 'FORGOT_PASSWORD';
      case OtpPurpose.mobileChange:
        return 'MOBILE_CHANGE';
    }
  }
}
