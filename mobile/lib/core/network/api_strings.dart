class ApiStrings {
  ApiStrings._();

  // --- Auth ---
  static const String authLogin = 'api/auth/login';
  static const String authGoogleLogin = 'api/auth/google/login';
  static const String authCheckActiveSession = 'api/auth/check-active-session';
  static const String authLogout = 'api/auth/logout';
  static const String authResendVerification = 'api/auth/resend-verification';
  static const String authCsrfRefresh = 'api/auth/csrf-token';
  static const String authForgotPassword = 'api/auth/forgot/password';
  static const String authResetPassword = 'api/auth/reset/password';
  static const String authVerifyEmail = 'api/auth/verify/email';

  // --- Registration ---
  static const String authRegister = 'api/auth/register';

  // --- Countries ---
  static const String countries = 'api/countries';

  // --- Attachments ---
  // Resolves an attachment id to a (signed, expiring) image URL.
  // Mirrors Angular's `AttachmentService.getAttachment` →
  // `attachments/url/{id}` returning `{url, expiresAt, ...}`.
  static String attachmentUrl(String id) => 'api/attachments/url/$id';

  // --- Users ---
  static const String usersMe = 'api/users/me';
  static const String usersMeChangePassword = 'api/users/me/change-password';
  static const String usersCompleteProfile = 'api/users/profile/complete';
  static const String usersPreferences = 'api/users/preferences';
  static const String usersProfile = 'api/users/profile';

  // --- App Settings (subject reset) ---
  static const String resetProgressSubject = 'api/reset/progress/subject';
  static const String resetAnalyticsSubject = 'api/reset/analytics/subject';

  // --- Dashboard ---
  static const String dashboardPackages = 'api/subscriptions/packages';
  static const String dashboardAchievements = 'api/dashboard/achievements';
  static const String dashboardGamification = 'api/dashboard/gamification';
  static const String dashboardStats = 'api/dashboard/stats';
  static const String dashboardProgress = 'api/dashboard/progress';
  static const String dashboardLeaderboard = 'api/dashboard/leaderboard';
  static const String dashboardSubjectProgress =
      'api/dashboard/subject/progress';
  static const String dashboardRecommendations =
      'api/dashboard/recommendations';

  // --- Set Study ---
  static const String setStudyPackageSubjects = 'api/packages';
  static const String setStudyPlans = 'api/study-planner/plans';
  static const String setStudyFilterPreview = 'api/question-filter';
  static const String setStudyStartTest = 'api/tests';
  // POST `api/tests/custom` — creates a study session from explicit
  // question ids (used by Question Search "Create Test" flow).
  static const String createCustomTest = 'api/tests/custom';

  // --- Study Session lifecycle ---
  static const String studySessions = 'api/tests';
  static String studySessionById(String id) => 'api/tests/$id';
  static String studySessionQuestionIds(String id) =>
      'api/tests/$id/question-ids';
  static String studySessionSave(String id) => 'api/tests/$id/save';
  static String studySessionComplete(String id) => 'api/tests/$id/complete';
  static String studySessionCurrentQuestionIndex(String id) =>
      'api/tests/$id/currentQuestionIndex';
  static String studySessionHeartbeat(String id) => 'api/tests/$id/heartbeat';

  // --- Study Session questions ---
  static String sessionQuestion(String sessionId, String questionId) =>
      'api/tests/$sessionId/questions/$questionId';
  static String submitAnswer(String sessionId, String questionId) =>
      'api/tests/$sessionId/questions/$questionId/answer';

  // --- Question content (sessionless single-question fetch) ---
  static String questionById(String questionId) => 'api/questions/$questionId';

  // --- Study Session explanations ---
  static String questionExplanations(String questionId) =>
      'api/questions/$questionId/explanations';
  static String explanationRating(String explanationId) =>
      'api/questions/explanations/$explanationId/rating';

  // --- Study Session notes ---
  static String noteForQuestion(String questionId) =>
      'api/questions/notes/question/$questionId';
  static const String notes = 'api/questions/notes';
  static String noteById(String noteId) => 'api/questions/notes/$noteId';

  // --- Study Session comments ---
  static String questionComments(String questionId) =>
      'api/questions/$questionId/comments';
  static const String comments = 'api/questions/comments';
  static String commentReact(String commentId) =>
      'api/questions/comments/$commentId/react';
  static String commentReport(String commentId) =>
      'api/questions/comments/$commentId/report';
  static String commentById(String commentId) =>
      'api/questions/comments/$commentId';

  // --- Study Session flags ---
  static String questionFlags(String questionId) =>
      'api/questions/$questionId/flags';

  // --- Study Session real exam reports ---
  static String questionRealExams(String questionId) =>
      'api/questions/$questionId/real-exams';
  static String reportSeenInExam(String questionId) =>
      'api/questions/$questionId/report-seen';

  // --- Study Session settings ---
  static const String userPreferences = 'api/users/preferences';

  // --- Study Session integrity ---
  // Mirrors Angular `IntegrityApiService` (core/integrity/
  // integrity-api.service.ts L16-37): per-session endpoints with the
  // sessionId in the URL, not the body.
  static String integrityEvents(String sessionId) =>
      'api/integrity/sessions/$sessionId/events';
  static String integrityInvalidate(String sessionId) =>
      'api/integrity/sessions/$sessionId/invalidate';

  // ── Shared Tests ──
  static const String sharedTestsSharedWithMe =
      'api/report/shared-test/shared-with-me';
  static const String sharedTestsSharedByMe =
      'api/report/shared-test/shared-by-me';
  static String deleteSharedTest(String shareRecordId) =>
      'api/report/shared-test/$shareRecordId';

  // ── Saved Tests ──
  static const String getTests = 'api/tests';
  static String deleteTestBySessionId(String sessionId) =>
      'api/tests/$sessionId';
  static String renameTestBySessionId(String sessionId) =>
      'api/tests/$sessionId/rename';
  static const String shareTest = 'api/report/shared-test';
  static const String subjectsList = 'api/packages/subjects';

  // ── Study Planner ──
  // Alias of setStudyPlans used by Set Study for dropdown. Leave both constants — different call sites.
  static const String studyPlannerPlans = 'api/study-planner/plans';
  static const String studyPlannerProgress = 'api/study-planner/plans/progress';
  static String studyPlannerPlanDetails(String planId) =>
      'api/study-planner/plans/$planId/plan-details';
  static const String studyPlannerCreatePlan = 'api/study-planner';
  static String studyPlannerCustomizePlan(String planId) =>
      'api/study-planner/customize-plan/plans/$planId';
  static String studyPlannerDeletePlan(String planId) =>
      'api/study-planner/plans/$planId';
  // Same path as deletePlan — different verbs; keep both constants for call-site readability.
  static String studyPlannerRenamePlan(String planId) =>
      'api/study-planner/plans/$planId';
  static const String studyPlannerCalculate = 'api/study-planner/calculate';
  static const String studyPlannerCalculateDeadline =
      'api/study-planner/calculate/deadline';
  // Same endpoint Set Study calls; per research R11 we re-declare here rather than cross-import.
  static const String studyPlannerSubscriptionsPackages =
      'api/subscriptions/packages';
  static String studyPlannerPackageSubjects(int packageId) =>
      'api/packages/$packageId/subjects';

  // ── Reports ──
  static const String reportTestHistory = 'api/report/test-history';
  static const String reportFindTest = 'api/report/test-history/find-test';
  static String reportTestHistoryDetails(String sessionId) =>
      'api/report/test-history-details/$sessionId';
  static String reportTestHistoryFilterDetails(String sessionId) =>
      'api/report/test-history-filter-details/$sessionId';
  static const String reportTestHistorySubjects =
      'api/report/test-history/subjects';
  static const String reportProgress = 'api/report/progress';
  static const String dashboardActivityHeatmap =
      'api/dashboard/activity-heatmap';
  static const String reportDifficultQuestions =
      'api/report/difficult-questions';
  static const String reportDifficultQuestionsIds =
      'api/report/difficult-questions/ids';
  static const String reportFlaggedQuestions = 'api/report/flagged/questions';
  static const String reportFlaggedQuestionsIds =
      'api/report/flagged/questions/ids';
  static const String reportNotesQuestions = 'api/report/notes/questions';
  static const String reportNotesQuestionsIds =
      'api/report/notes/questions/ids';
  static const String reportCommentsQuestions =
      'api/report/comments/questions';
  static const String reportCommentsQuestionsIds =
      'api/report/comments/questions/ids';
  static String testsRename(String sessionId) =>
      'api/tests/$sessionId/rename';
  static String testsDelete(String sessionId) => 'api/tests/$sessionId';
  static const String testsCustom = 'api/tests/custom';
  static const String reportSharedTest = 'api/report/shared-test';

  // ── E-Shop (011) ──
  static const String eshopPackages = 'api/packages';
  static const String couponsValidate = 'api/coupons/validate';
  static const String paymentCreateCheckoutSession =
      'api/payment/create-checkout-session';
  static String paymentSession(String id) => 'api/payment/session/$id';
  static String subscriptionsInvoices(String id) =>
      'api/subscriptions/invoices/$id';
  static const String subscriptionsActive = 'api/subscriptions/active';
  static const String subscriptionsHistory = 'api/subscriptions/history';

  // ── Question Search ──
  static const String questionSearch = 'api/search';
  static const String questionSearchSelectAllIds = 'api/search/ids';
  /// Same endpoint as `studyPlannerSubscriptionsPackages`; re-declared per project precedent (R8).
  static const String questionSearchSubscriptionsPackages =
      'api/subscriptions/packages';
  static String questionSearchPackageSubjects(int packageId) =>
      'api/packages/$packageId/subjects';

  // --- Notifications ---
  static const String notifications = 'api/notifications';
  static const String notificationsUnreadCount = 'api/notifications/unread/count';
  static const String notificationsReadAll = 'api/notifications/read/all';
  static const String notificationsFcmToken = 'api/notifications/fcm-token';

  // --- Contact Us (017) ---
  static const String contactUs = 'api/contact-us';

  // --- FAQ (018) ---
  static const String faqPublic = 'api/faq/public';

  // --- Legacy (kept for backwards compat with existing consumers) ---
  static const String login = authLogin;
  static const String logout = authLogout;
  static const String refreshToken = 'api/auth/refresh-token';
  static const String profile = usersMe;
  static const String home = 'api/home';
}
