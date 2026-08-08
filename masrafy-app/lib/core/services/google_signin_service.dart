import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

/// Sensitive scope that unlocks the date of birth. The ID token carries no
/// birthday claim, so this is the only route to it — and the customer may
/// refuse it, which is why [GoogleSignInService] can fall back without it.
const String _kBirthdayScope = 'https://www.googleapis.com/auth/user.birthday.read';

const List<String> _kBaseScopes = ['email', 'profile'];

/// Tokens handed back by a successful Google sign-in.
///
/// [idToken] is the identity proof — the backend verifies its signature and
/// derives the account from it. [accessToken] is authorization only: the
/// backend uses it to read the birthday from the People API and nothing else.
/// It is null whenever the birthday scope was not granted.
class GoogleSignInTokens {
  const GoogleSignInTokens({required this.idToken, this.accessToken});

  final String idToken;
  final String? accessToken;
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
///
/// Two clients, deliberately: the access token is minted for the scope list the
/// client was CONSTRUCTED with, so the birthday scope has to be declared
/// up-front to appear in it — but a customer who declines that scope then makes
/// the token request fail, and the ID token is fetched by the same call. The
/// narrow client is the fallback that keeps sign-in working in that case,
/// simply without a birthday.
class GoogleSignInService {
  GoogleSignInService({required String serverClientId})
      : _withBirthday = GoogleSignIn(
          serverClientId: serverClientId,
          scopes: const [..._kBaseScopes, _kBirthdayScope],
        ),
        _baseOnly = GoogleSignIn(
          serverClientId: serverClientId,
          scopes: _kBaseScopes,
        );

  final GoogleSignIn _withBirthday;
  final GoogleSignIn _baseOnly;

  /// Drives the native account chooser and returns the Google tokens, or
  /// `null` if the user cancelled. A pre-`signOut` clears any cached account so
  /// the chooser always appears (rather than silently reusing a stale login).
  Future<GoogleSignInTokens?> obtainTokens() async {
    final tokens = await _signIn(_withBirthday);
    // Cancellation is a decision, not a failure — do not re-prompt with the
    // narrow client, or dismissing the chooser would just show it again.
    if (tokens != null || _cancelled) return tokens;

    if (kDebugMode) {
      debugPrint('Google birthday scope unavailable — retrying with base scopes.');
    }
    return _signIn(_baseOnly);
  }

  Future<void> signOut() async {
    await _withBirthday.signOut();
    await _baseOnly.signOut();
  }

  bool _cancelled = false;

  /// Runs one full sign-in against [client]. Returns null both when the user
  /// dismissed the chooser (recorded on [_cancelled]) and when the token
  /// request failed — the caller distinguishes the two.
  Future<GoogleSignInTokens?> _signIn(GoogleSignIn client) async {
    _cancelled = false;
    await client.signOut();
    final account = await client.signIn();
    if (account == null) {
      _cancelled = true;
      return null; // user dismissed the chooser
    }
    try {
      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) return null;
      return GoogleSignInTokens(idToken: idToken, accessToken: auth.accessToken);
    } catch (e) {
      // Minting the access token failed — on Android that is what a declined
      // sensitive scope looks like, and it takes the ID token with it.
      if (kDebugMode) debugPrint('Google token request failed: $e');
      return null;
    }
  }
}
