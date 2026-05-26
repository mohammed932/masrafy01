class SignupPhoneCompleteRequest {
  const SignupPhoneCompleteRequest({
    required this.verifiedMobileToken,
    required this.name,
    this.email,
    required this.password,
    required this.age,
  });

  final String verifiedMobileToken;
  final String name;
  final String? email;
  final String password;
  final int age;

  Map<String, dynamic> toJson() => {
        'verifiedMobileToken': verifiedMobileToken,
        'name': name,
        if (email != null && email!.isNotEmpty) 'email': email,
        'password': password,
        'age': age,
      };
}
