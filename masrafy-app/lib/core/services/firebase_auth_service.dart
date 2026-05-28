import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:google_sign_in/google_sign_in.dart';
import 'package:injectable/injectable.dart';

import '../network/erros/exceptions.dart';

/// Thin wrapper over `firebase_auth` + `google_sign_in`.
///
/// Every other layer sees only [AppException] subtypes — Firebase error codes
/// never escape this file. Returns the Firebase ID token on success; the
/// backend validates it via `POST /api/auth/login` or `/api/auth/google/login`.
@injectable
class FirebaseAuthService {
  final fb.FirebaseAuth _auth;
  final GoogleSignIn _googleSignIn;

  FirebaseAuthService()
      : _auth = fb.FirebaseAuth.instance,
        _googleSignIn = GoogleSignIn();

  fb.User? get currentUser => _auth.currentUser;

  /// Returns the Firebase ID token, refreshing if near-expiry.
  /// Throws [UnauthorizedException] if no Firebase user is signed in.
  Future<String> getIdToken({bool forceRefresh = false}) async {
    final user = _auth.currentUser;
    if (user == null) throw const UnauthorizedException('Not signed in');
    final token = await user.getIdToken(forceRefresh);
    if (token == null) throw const UnauthorizedException('Token unavailable');
    return token;
  }

  Future<String> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    try {
      final credential = await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
      final token = await credential.user?.getIdToken();
      if (token == null) {
        throw const UnauthorizedException('Failed to obtain Firebase token');
      }
      return token;
    } on fb.FirebaseAuthException catch (e) {
      throw FirebaseAuthException(
        code: e.code,
        rawMessage: e.message ?? e.code,
      );
    }
  }

  /// Returns a record with the Firebase ID token plus the Google display data
  /// needed by `POST /api/auth/google/login` (firebaseUid, email, displayName,
  /// photoURL).
  Future<GoogleSignInResult> signInWithGoogle() async {
    try {
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        throw const GoogleSignInCancelledException();
      }
      final auth = await googleUser.authentication;
      final credential = fb.GoogleAuthProvider.credential(
        idToken: auth.idToken,
        accessToken: auth.accessToken,
      );
      final userCredential = await _auth.signInWithCredential(credential);
      final user = userCredential.user;
      if (user == null) {
        throw const UnauthorizedException('Firebase sign-in returned no user');
      }
      final idToken = await user.getIdToken();
      if (idToken == null) {
        throw const UnauthorizedException('Failed to obtain Firebase token');
      }
      return GoogleSignInResult(
        idToken: idToken,
        firebaseUid: user.uid,
        email: user.email ?? googleUser.email,
        displayName: user.displayName ?? googleUser.displayName ?? '',
        photoURL: user.photoURL ?? googleUser.photoUrl,
      );
    } on fb.FirebaseAuthException catch (e) {
      throw FirebaseAuthException(
        code: e.code,
        rawMessage: e.message ?? e.code,
      );
    }
  }

  Future<void> signOut() async {
    await _googleSignIn.signOut();
    await _auth.signOut();
  }
}

class GoogleSignInResult {
  final String idToken;
  final String firebaseUid;
  final String email;
  final String displayName;
  final String? photoURL;

  const GoogleSignInResult({
    required this.idToken,
    required this.firebaseUid,
    required this.email,
    required this.displayName,
    this.photoURL,
  });
}
