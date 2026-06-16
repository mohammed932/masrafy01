/// Centralised path constants for every masrafy backend endpoint the
/// mobile app talks to. Private constructor — never instantiate. Static
/// constants for fixed paths; static methods for parameterised paths.
///
/// masrafy shape (Principle XXX adjacency — datasources build
/// [MasrafyEndpoint]s from these constants so a backend rename is a
/// one-line edit here).
class ApiStrings {
  ApiStrings._();

  // --- Customer auth (Phase 1, Constitution v1.7.0) ---
  static const String authSignup = '/api/v1/auth/signup';
  static const String authLogin = '/api/v1/auth/login';
  static const String authRefresh = '/api/v1/auth/refresh';
  static const String authLogout = '/api/v1/auth/logout';
  static const String authMe = '/api/v1/auth/me';
  static const String authClaimApplications = '/api/v1/auth/claim-applications';

  // --- Public catalog reads ---
  static const String mobileBankPrograms = '/api/v1/bank-programs';
  static String mobileBankProgramByCode(String code) =>
      '/api/v1/bank-programs/$code';
  static String platformEnumerationsByType(String type) =>
      '/api/v1/platform-enumerations/$type';

  // --- Onboarding ---
  static const String onboardingScreens = '/api/v1/onboarding/screens';

  // --- Wizard / matching engine ---
  static const String apply = '/api/v1/apply';

  // --- Feature 009 — Dynamic questionnaire + matching preview ---
  static String questionnaireByCategory(String category) =>
      '/api/v1/questionnaire/$category';
  static const String matchingPreview = '/api/v1/matching/preview';

  // --- Applications ---
  static String applicationSelectOffer(String applicationId) =>
      '/api/v1/applications/$applicationId/select-offer';

  // --- Mobile document upload ---
  static String documentUploadUrl(String applicationId) =>
      '/api/v1/applications/$applicationId/documents/upload-url';
  static String documentConfirmUpload(String applicationId, String documentId) =>
      '/api/v1/applications/$applicationId/documents/$documentId/confirm-upload';

  // --- Support ---
  static const String supportContact = '/api/v1/support/contact';
  static const String supportRequests = '/api/v1/support/requests';

  // --- Telemetry (funnel beacons) ---
  static const String telemetryEvent = '/api/v1/telemetry/event';

  // --- Feature 008 — Two-Path Registration (Constitution v1.8.0) ---
  static const String authSignupPhoneStart = '/api/v1/auth/signup/phone/start';
  static const String authSignupPhoneComplete = '/api/v1/auth/signup/phone/complete';
  static const String authOtpRequest = '/api/v1/auth/otp/request';
  static const String authOtpVerify = '/api/v1/auth/otp/verify';
  static const String authSocialGoogle = '/api/v1/auth/social/google';
  static const String authSocialApple = '/api/v1/auth/social/apple';
  static const String authSocialLogin = '/api/v1/auth/social/login';
  static const String authProfileMobileRequestOtp = '/api/v1/auth/profile/mobile-request-otp';
  static const String authProfileMobileVerifyOtp = '/api/v1/auth/profile/mobile-verify-otp';
  static const String authPasswordReset = '/api/v1/auth/password/reset';
  static const String authPasswordChange = '/api/v1/auth/password/change';
}
