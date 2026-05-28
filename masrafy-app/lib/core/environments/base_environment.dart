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

  /// Custom URL scheme used by Stripe Checkout to redirect back into the
  /// app. Consumed by `flutter_web_auth_2` as `callbackUrlScheme`.
  static const String kEshopDeeplinkScheme = 'masrafy';

  /// Shared secret used by `DecryptionInterceptor` to decrypt responses
  /// marked with `X-Encrypted: true`. SHA-256 is applied to derive the
  /// 32-byte AES-256-GCM key. Value mirrors Angular's
  /// `environment.CLIENT_SECRET_KEY` — same in dev/prod today.
  String get clientSecretKey;
}
