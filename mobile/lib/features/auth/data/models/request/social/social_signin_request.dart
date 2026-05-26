class SocialGoogleSignInRequest {
  const SocialGoogleSignInRequest({required this.idToken});
  final String idToken;
  Map<String, dynamic> toJson() => {'idToken': idToken};
}

/// Apple's first-sign-in-only payload (name + email) is forwarded via
/// `userInfo` — the backend trusts the first-contact email per FR-029.
class SocialAppleSignInRequest {
  const SocialAppleSignInRequest({
    required this.idToken,
    this.userInfoEmail,
    this.userInfoFullName,
  });
  final String idToken;
  final String? userInfoEmail;
  final String? userInfoFullName;

  Map<String, dynamic> toJson() => {
        'idToken': idToken,
        if (userInfoEmail != null || userInfoFullName != null)
          'userInfo': {
            if (userInfoEmail != null) 'email': userInfoEmail,
            if (userInfoFullName != null) 'fullName': userInfoFullName,
          },
      };
}

class SocialLoginRequest {
  const SocialLoginRequest({required this.socialSessionId});
  final String socialSessionId;
  Map<String, dynamic> toJson() => {'socialSessionId': socialSessionId};
}
