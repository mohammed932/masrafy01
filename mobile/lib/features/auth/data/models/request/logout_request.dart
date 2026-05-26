/// Wire payload for `POST /api/v1/auth/logout`. The backend revokes the
/// passed refresh token; clients without one (best-effort logout) still
/// hit the endpoint with `null` so the audit event fires.
class LogoutRequest {
  const LogoutRequest({this.refreshToken});

  final String? refreshToken;

  Map<String, dynamic>? toJson() =>
      refreshToken == null ? null : {'refreshToken': refreshToken};
}
