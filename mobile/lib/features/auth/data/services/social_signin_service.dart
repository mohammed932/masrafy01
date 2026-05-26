import 'dart:io' show Platform;

import 'package:google_sign_in/google_sign_in.dart';
import 'package:injectable/injectable.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

/// Result of obtaining a provider ID-token from a native SDK. The backend
/// verifies the token via `google-auth-library` / `jose` against the
/// provider's JWKs.
class NativeSocialResult {
  const NativeSocialResult({
    required this.idToken,
    this.email,
    this.fullName,
  });
  final String idToken;
  final String? email;
  final String? fullName;
}

/// Abstracts the native provider SDK calls (Google + Apple). The cubit
/// consumes this service, not the SDKs directly — keeps testing + platform
/// branching in one place.
///
/// Constitution v1.8.0 / R15: Apple Sign-In is iOS-only in v1; on Android
/// the landing screen hides the Apple button (see `LandingPage._showApple`).
/// Calling `signInWithApple` on Android throws.
@injectable
class SocialSignInService {
  SocialSignInService();

  /// Triggers the Google Sign-In sheet on the native side, returns the
  /// verifiable ID token + provider profile preview.
  Future<NativeSocialResult> signInWithGoogle() async {
    final google = GoogleSignIn();
    final account = await google.signIn();
    if (account == null) {
      throw const SocialSignInCancelledException();
    }
    final auth = await account.authentication;
    final idToken = auth.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw const SocialSignInTokenMissingException();
    }
    return NativeSocialResult(
      idToken: idToken,
      email: account.email,
      fullName: account.displayName,
    );
  }

  /// Triggers the Apple Sign-In sheet on iOS. Apple returns `email` + name
  /// only on the FIRST sign-in; subsequent sign-ins return only the
  /// `userIdentifier` (sub). The first-contact email is captured here and
  /// forwarded to the backend's `userInfo` payload — see
  /// `SocialAppleSignInRequest`.
  Future<NativeSocialResult> signInWithApple() async {
    if (!Platform.isIOS) {
      throw const SocialSignInProviderNotSupportedException();
    }
    final credential = await SignInWithApple.getAppleIDCredential(
      scopes: [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
    );
    final idToken = credential.identityToken;
    if (idToken == null || idToken.isEmpty) {
      throw const SocialSignInTokenMissingException();
    }
    final fullName = [credential.givenName, credential.familyName]
        .where((p) => p != null && p.isNotEmpty)
        .join(' ');
    return NativeSocialResult(
      idToken: idToken,
      email: credential.email,
      fullName: fullName.isEmpty ? null : fullName,
    );
  }

  /// Best-effort logout from the Google session. Apple has no logout (the
  /// Apple ID session is owned by the OS).
  Future<void> signOutGoogle() async {
    try {
      await GoogleSignIn().signOut();
    } catch (_) {
      // Swallow — backend logout is authoritative.
    }
  }
}

// --- Typed exceptions surfaced as Failures by ApiHandler --------------------

class SocialSignInCancelledException implements Exception {
  const SocialSignInCancelledException();
  @override
  String toString() => 'social_signin_cancelled';
}

class SocialSignInTokenMissingException implements Exception {
  const SocialSignInTokenMissingException();
  @override
  String toString() => 'social_signin_token_missing';
}

class SocialSignInProviderNotSupportedException implements Exception {
  const SocialSignInProviderNotSupportedException();
  @override
  String toString() => 'social_signin_provider_not_supported';
}
