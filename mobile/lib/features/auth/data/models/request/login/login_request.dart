/// Wire payload for `POST /api/v1/auth/login`. Constitution Principle XI
/// — typed `*Request` end-to-end; the cubit constructs this DTO, the
/// repository forwards it, the datasource calls `.toJson()` at the wire.
class LoginRequest {
  const LoginRequest({required this.phone, required this.password});

  final String phone;
  final String password;

  Map<String, dynamic> toJson() => {
        'phone': phone,
        'password': password,
      };
}
