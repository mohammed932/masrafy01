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
  /// [googleServerClientId] MUST be a **Web**-type OAuth client — Android only
  /// returns an ID token when `serverClientId` is a Web client, and (since it
  /// is passed to `GoogleSignIn` on both platforms) it also becomes the token
  /// `aud` on iOS. [googleIosClientId] MUST be the **iOS**-type client (also
  /// mirrored in `ios/Runner/Info.plist` as `GIDClientID` + reversed URL
  /// scheme). Confirm both IDs' types in the GCP console and swap if Android
  /// sign-in fails with `SOCIAL_TOKEN_INVALID`.
  String get googleServerClientId =>
      '541863670328-vrcdi686870n6str4kvrhv6lkehhp1qo.apps.googleusercontent.com';

  String get googleIosClientId =>
      '541863670328-ohvcqa1qat08rmfa8dd72mp7hmfml3ee.apps.googleusercontent.com';
}
