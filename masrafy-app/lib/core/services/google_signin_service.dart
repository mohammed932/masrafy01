import 'package:google_sign_in/google_sign_in.dart';

/// Thin platform wrapper over `google_sign_in` (v6.x API) that yields a raw
/// Google **ID token** for the masrafy customer-auth social flow
/// (`POST /api/v1/auth/social/google`). The backend verifies the token
/// directly via `google-auth-library`, so — unlike the legacy
/// [FirebaseAuthService] — this does NOT round-trip through Firebase Auth.
///
/// [serverClientId] sets the token `aud` (must match the backend
/// `GOOGLE_OAUTH_CLIENT_IDS` allow-list) and is what makes Android emit an ID
/// token at all. The iOS client ID comes from `Info.plist` (`GIDClientID`).
class GoogleSignInService {
  GoogleSignInService({required String serverClientId})
      : _google = GoogleSignIn(
          serverClientId: serverClientId,
          scopes: const ['email', 'profile'],
        );

  final GoogleSignIn _google;

  /// Drives the native account chooser and returns the Google ID token, or
  /// `null` if the user cancelled. A pre-`signOut` clears any cached account so
  /// the chooser always appears (rather than silently reusing a stale login).
  Future<String?> obtainIdToken() async {
    await _google.signOut();
    final account = await _google.signIn();
    if (account == null) return null; // user dismissed the chooser
    final auth = await account.authentication;
    return auth.idToken;
  }

  Future<void> signOut() => _google.signOut();
}
