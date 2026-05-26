class ProfileMobileRequestOtpRequest {
  const ProfileMobileRequestOtpRequest({required this.phone});
  final String phone;
  Map<String, dynamic> toJson() => {'phone': phone};
}

class ProfileMobileVerifyOtpRequest {
  const ProfileMobileVerifyOtpRequest({required this.otpId, required this.code});
  final String otpId;
  final String code;
  Map<String, dynamic> toJson() => {'otpId': otpId, 'code': code};
}
