class SocialGoogleSignInRequest {
  const SocialGoogleSignInRequest({required this.idToken});
  final String idToken;

  /// No `accessToken`: the app no longer asks for the restricted
  /// `user.birthday.read` scope, so there is no People API call to authorize
  /// (see `GoogleSignInService`). The backend still accepts the field as
  /// optional and resolves a missing birthday to null, so nothing breaks by its
  /// absence — the customer supplies the birthday at profile completion.
  Map<String, dynamic> toJson() => {'idToken': idToken};
}

class SocialLoginRequest {
  const SocialLoginRequest({required this.socialSessionId});
  final String socialSessionId;
  Map<String, dynamic> toJson() => {'socialSessionId': socialSessionId};
}
