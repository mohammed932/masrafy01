/// Wire payload for `POST /api/v1/auth/login`. Constitution Principle XI
/// — typed `*Request` end-to-end; the cubit constructs this DTO, the
/// repository forwards it, the datasource calls `.toJson()` at the wire.
class LoginRequest {
  const LoginRequest({required this.email, required this.password});

  final String email;
  final String password;

  Map<String, dynamic> toJson() => {
        'email': email,
        'password': password,
      };
}
