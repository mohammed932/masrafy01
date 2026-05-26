/// Wire payload for `POST /api/v1/auth/signup`. Constitution Principle XI
/// typed end-to-end. Optional fields (`email`, `locale`) are omitted from
/// the JSON when null so the backend's defaults apply.
class SignupRequest {
  const SignupRequest({
    required this.phone,
    required this.name,
    required this.password,
    this.email,
    this.locale,
  });

  final String phone;
  final String name;
  final String password;
  final String? email;
  final String? locale;

  Map<String, dynamic> toJson() => {
        'phone': phone,
        'name': name,
        'password': password,
        if (email != null && email!.isNotEmpty) 'email': email,
        if (locale != null) 'locale': locale,
      };
}
