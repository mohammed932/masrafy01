/// Per-flavor runtime configuration. Mirrors Angular env shape per
/// constitution Principle VIII.
///
/// Firebase configuration is NOT here — it's read from the platform files
/// `android/app/google-services.json` and `ios/Runner/GoogleService-Info.plist`
/// by `Firebase.initializeApp()` at launch.
abstract class BaseEnvironment {
  String get baseUrl;

  /// Base URL of the Angular web frontend. Defaults to [baseUrl];
  /// override per env if the frontend is hosted elsewhere.
  String get webBaseUrl => baseUrl;

  bool get isProduction;
  bool get onboardingEnabled;

  /// Master switch for the biometric app-lock gate. When false the lock is
  /// never shown (cold start or resume) — used to disable it in dev/test.
  bool get biometricEnabled;

  /// Google OAuth client IDs (GCP project `541863670328`). Feed
  /// `GoogleSignInService`, which obtains an ID token whose `aud` MUST be in
  /// the backend `GOOGLE_OAUTH_CLIENT_IDS` allow-list (verified server-side by
  /// `google-auth-library`).
  ///
  /// The project has three clients; each type below was confirmed against
  /// Google's authorize endpoint, not guessed from the console list:
  /// - [googleServerClientId] — **Web**. Android only returns an ID token when
  ///   `serverClientId` is a Web client, and (since it is passed to
  ///   `GoogleSignIn` on both platforms) it also becomes the token `aud` on iOS.
  /// - [googleIosClientId] — **iOS**, bundle `com.masrafy01.app`. The plugin
  ///   reads it from `ios/Runner/Info.plist` (`GIDClientID` + the reversed ID
  ///   as a URL scheme), not from here — keep the three copies identical.
  /// - `541863670328-ohvcqa1qat08rmfa8dd72mp7hmfml3ee` — **Android**. Google
  ///   matches it by package name + signing SHA-1, so the app never names it.
  ///   Put in `GIDClientID`, every iOS sign-in dies at Google with
  ///   `Error 400: invalid_request` ("Custom URI scheme is not enabled for
  ///   your Android client").
  String get googleServerClientId =>
      '541863670328-vrcdi686870n6str4kvrhv6lkehhp1qo.apps.googleusercontent.com';

  String get googleIosClientId =>
      '541863670328-8714inlo0u8obu8ef121c8da9bt8m1r4.apps.googleusercontent.com';
}
