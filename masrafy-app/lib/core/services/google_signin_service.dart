import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

/// Non-sensitive scopes only. `user.birthday.read` is deliberately NOT here:
/// it is a Google-restricted scope, so on an unverified OAuth client every
/// sign-in dies at the consent screen with `403 access_denied` ("has not
/// completed the Google verification process") — including for testers, whose
/// allow-list does not cover restricted scopes. Birthday is collected in the
/// mandatory profile-completion step anyway (Principle XXXVII), so the provider
/// prefill was never worth gating sign-in on. Re-add it here (and resume
/// sending `accessToken`) only once the client passes Google verification.
const List<String> _kScopes = ['email', 'profile'];

/// Tokens handed back by a successful Google sign-in.
///
/// [idToken] is the identity proof, and the only thing the backend needs — it
/// verifies the signature and derives the account (plus the avatar, from the
/// `picture` claim) from it.
class GoogleSignInTokens {
  const GoogleSignInTokens({required this.idToken});

  final String idToken;
}

/// Thin platform wrapper over `google_sign_in` (v6.x API) that yields a raw
/// Google **ID token** for the masrafy customer-auth social flow
/// (`POST /api/v1/auth/google/signin`). The backend verifies the token
/// directly via `google-auth-library`, so this does NOT round-trip through
/// Firebase Auth.
///
/// [serverClientId] sets the token `aud` (must match the backend
/// `GOOGLE_OAUTH_CLIENT_IDS` allow-list) and is what makes Android emit an ID
/// token at all. The iOS client ID comes from `Info.plist` (`GIDClientID`).
class GoogleSignInService {
  GoogleSignInService({required String serverClientId})
      : _client = GoogleSignIn(
          serverClientId: serverClientId,
          scopes: _kScopes,
        );

  final GoogleSignIn _client;

  /// Drives the native account chooser and returns the Google tokens, or
  /// `null` if the user cancelled or the token request failed. A pre-`signOut`
  /// clears any cached account so the chooser always appears (rather than
  /// silently reusing a stale login).
  Future<GoogleSignInTokens?> obtainTokens() async {
    await _client.signOut();
    final account = await _client.signIn();
    if (account == null) return null; // user dismissed the chooser

    try {
      final idToken = (await account.authentication).idToken;
      if (idToken == null) return null;
      return GoogleSignInTokens(idToken: idToken);
    } catch (e) {
      if (kDebugMode) debugPrint('Google token request failed: $e');
      return null;
    }
  }

  Future<void> signOut() => _client.signOut();
}
