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
  /// One GLOBAL questionnaire since feature 010 / constitution v10.0.0 — the
  /// category filters which programs match, never which questions are asked.
  static const String questionnaire = '/api/v1/questionnaire';
  static const String matchingPreview = '/api/v1/matching/preview';

  // --- Applications ---
  static const String applications = '/api/v1/applications';
  static String applicationSelectOffer(String applicationId) =>
      '/api/v1/applications/$applicationId/select-offer';

  // --- Saved offers (Saved Offers screen) ---
  static const String savedOffers = '/api/v1/saved-offers';
  static String savedOfferDelete(String bankOfferId) =>
      '/api/v1/saved-offers/$bankOfferId';

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
  static const String authSignupPhoneVerify = '/api/v1/auth/signup/phone/verify';
  static const String authOtpRequest = '/api/v1/auth/otp/request';
  static const String authOtpVerify = '/api/v1/auth/otp/verify';
  static const String authSocialGoogle = '/api/v1/auth/social/google';
  static const String authSocialApple = '/api/v1/auth/social/apple';
  static const String authSocialLogin = '/api/v1/auth/social/login';
  // Dedicated one-call social endpoints (tokens returned directly).
  static const String authGoogleSignin = '/api/v1/auth/google/signin';
  static const String authAppleLogin = '/api/v1/auth/apple/login';
  static const String authProfileMobileRequestOtp = '/api/v1/auth/profile/mobile-request-otp';
  static const String authProfileMobileVerifyOtp = '/api/v1/auth/profile/mobile-verify-otp';
  static const String authPasswordReset = '/api/v1/auth/password/reset';
  static const String authPasswordChange = '/api/v1/auth/password/change';

  // --- Profile completion (Principle XXXVII) ---
  static const String authProfileComplete = '/api/v1/auth/profile/complete';

  /// Post-completion scalar edit (name/email/governorate/city/address).
  static const String authProfile = '/api/v1/auth/profile';
  static const String profilePhotoUploadUrl = '/api/v1/profile/photo/upload-url';
  static const String profilePhotoConfirm = '/api/v1/profile/photo/confirm-upload';
  static const String profileDocUploadUrl = '/api/v1/profile/documents/upload-url';
  static String profileDocConfirmUpload(String documentId) =>
      '/api/v1/profile/documents/$documentId/confirm-upload';

  /// Which apply documents are already uploaded (photo + National ID sides) —
  /// pre-checks the apply-time document screen (Constitution v9.0.1).
  static const String profileDocumentsStatus = '/api/v1/profile/documents/status';
}
