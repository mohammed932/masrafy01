class SocialGoogleSignInRequest {
  const SocialGoogleSignInRequest({required this.idToken, this.accessToken});
  final String idToken;

  /// Authorization-only token — lets the backend read the birthday from the
  /// People API. Null when the customer declined the birthday scope; the field
  /// is then omitted from the body rather than sent as null.
  final String? accessToken;

  Map<String, dynamic> toJson() => {
        'idToken': idToken,
        if (accessToken != null) 'accessToken': accessToken,
      };
}

class SocialLoginRequest {
  const SocialLoginRequest({required this.socialSessionId});
  final String socialSessionId;
  Map<String, dynamic> toJson() => {'socialSessionId': socialSessionId};
}
