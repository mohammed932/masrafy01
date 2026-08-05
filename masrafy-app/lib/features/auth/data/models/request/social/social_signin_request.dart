class SocialGoogleSignInRequest {
  const SocialGoogleSignInRequest({required this.idToken});
  final String idToken;
  Map<String, dynamic> toJson() => {'idToken': idToken};
}

class SocialLoginRequest {
  const SocialLoginRequest({required this.socialSessionId});
  final String socialSessionId;
  Map<String, dynamic> toJson() => {'socialSessionId': socialSessionId};
}
