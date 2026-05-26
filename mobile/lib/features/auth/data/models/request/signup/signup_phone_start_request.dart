class SignupPhoneStartRequest {
  const SignupPhoneStartRequest({required this.phone, required this.locale});

  final String phone;
  final String locale;

  Map<String, dynamic> toJson() => {'phone': phone, 'locale': locale};
}
