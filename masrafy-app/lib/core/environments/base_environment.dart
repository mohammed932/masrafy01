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
}
