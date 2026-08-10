/// Static asset paths.
///
/// Icons live under `resources/icons/<feature>/`; full-size art under
/// `resources/images/<feature>/`. SVGs load via `flutter_svg`, PNGs via
/// `Image.asset`. When two features need the same glyph, define one
/// canonical const and alias the other (search `// alias`).
class MasrafyAssets {
  MasrafyAssets._();

  // ── Branding ──────────────────────────────────────────────────────────────
  static const String masrafyLogo = 'resources/icons/logo.png';
  static const String masrafyLogoDark = 'resources/icons/logo_dark.png';
  static const String kDefaultAvatar = 'resources/images/default-avatar.png';

  // ── Icons — common ────────────────────────────────────────────────────────
  static const String kArrowDown = 'resources/icons/common/arrow_down.svg';
  static const String kArrowSmallUp = 'resources/icons/arrow_small_up.svg';
  static const String kBankTwotone = 'resources/icons/common/bank_twotone.svg';
  static const String kCalendarTwoTone = 'resources/icons/calendar_twotone.svg';
  static const String kCalNavDoubleLeft =
      'resources/icons/common/cal_nav_double_left.svg';
  static const String kCalNavDoubleRight =
      'resources/icons/common/cal_nav_double_right.svg';
  static const String kCalNavLeft = 'resources/icons/common/cal_nav_left.svg';
  static const String kCalNavRight = 'resources/icons/common/cal_nav_right.svg';
  static const String kCheck = 'resources/icons/common/check.svg';
  static const String kChevronDown =
      'resources/icons/set_study/chevron_down.svg';
  static const String kCloseCircleFilled =
      'resources/icons/close_circle_filled.svg';
  static const String kEnvironmentOutlined =
      'resources/icons/common/environment_outlined.svg';
  static const String kHourglassTwotone =
      'resources/icons/common/hourglass_twotone.svg';
  static const String kLockFilled = 'resources/icons/common/lock_filled.svg';
  static const String kMinus = 'resources/icons/faq/minus.svg';
  static const String kMobileTwotone =
      'resources/icons/common/mobile_twotone.svg';
  static const String kMoreOutlined =
      'resources/icons/study_screen/ellipsis.svg';
  static const String kNavigateOutlined =
      'resources/icons/common/navigate_outlined.svg';
  static const String kPhoneOutlined =
      'resources/icons/common/phone_outlined.svg';
  static const String kPlus = 'resources/icons/faq/plus.svg';
  static const String kShare = 'resources/icons/common/share.svg';

  // ── Icons — dashboard ─────────────────────────────────────────────────────
  static const String kDashboardCaretRight =
      'resources/icons/dashboard/caret_right.svg';
  // PNG, not SVG — the design asset is a stylized 3D raster export.
  static const String kDashboardCrown = 'resources/icons/dashboard/crown.png';

  // ── Icons — eshop ─────────────────────────────────────────────────────────
  static const String kEshopCheckCircleIcon =
      'resources/icons/eshop/eshop_check_circle.svg';
  static const String kEshopCrownIcon = 'resources/icons/eshop/eshop_crown.svg';
  static const String kEshopDashboardIcon =
      'resources/icons/eshop/eshop_dashboard.svg';
  static const String kEshopExperimentIcon =
      'resources/icons/eshop/eshop_experiment.svg';
  static const String kEshopPopularRibbonIcon =
      'resources/icons/eshop/eshop_popular_ribbon.svg';
  static const String kEshopRocketIcon =
      'resources/icons/eshop/eshop_rocket.svg';
  static const String kEshopThunderboltIcon =
      'resources/icons/eshop/eshop_thunderbolt.svg';

  // ── Icons — faq ───────────────────────────────────────────────────────────
  static const String kFaqMinus = kMinus; // alias
  static const String kFaqPlus = kPlus; // alias
  static const String kFaqSearch = 'resources/icons/faq/search.svg';

  // ── Icons — menu drawer ───────────────────────────────────────────────────
  static const String kMenuClose = 'resources/icons/menu/close_outlined.svg';
  static const String kMenuCreditCard =
      'resources/icons/menu/credit_card_twotone.svg';
  static const String kMenuLogout = 'resources/icons/menu/logout_outlined.svg';
  static const String kMenuMail = 'resources/icons/menu/mail_twotone.svg';
  static const String kMenuMoon = 'resources/icons/menu/moon_filled.svg';
  static const String kMenuQuestionCircle =
      'resources/icons/menu/question_circle_twotone.svg';
  static const String kMenuSafetyCertificate =
      'resources/icons/menu/safety_certificate_twotone.svg';
  static const String kMenuSetting = 'resources/icons/menu/setting_twotone.svg';
  static const String kMenuSun = 'resources/icons/menu/sun_filled.svg';
  static const String kMenuTrophy = 'resources/icons/menu/trophy_twotone.svg';
  static const String kMenuUser = 'resources/icons/menu/user_outlined.svg';

  // ── Icons — bottom nav ────────────────────────────────────────────────────
  // Customer-app nav glyphs (Figma 4138:162): wallet / filled-home / user.
  static const String kNavLoans = 'resources/icons/nav/nav_loans.svg';
  static const String kNavHomeFilled =
      'resources/icons/nav/nav_home_filled.svg';
  static const String kNavAccount = 'resources/icons/nav/nav_account.svg';
  static const String kNavEshop = 'resources/icons/nav/nav_eshop.svg';
  static const String kNavHome = 'resources/icons/nav/nav_home.svg';
  static const String kNavReports = 'resources/icons/nav/nav_reports.svg';
  static const String kNavStudyPlanner =
      'resources/icons/nav/nav_study_planner.svg';
  static const String kNavTestNew = 'resources/icons/nav/nav_test_new.svg';
  static const String kNavTestSaved = 'resources/icons/nav/nav_test_saved.svg';
  static const String kNavTests = 'resources/icons/nav/nav_tests.svg';

  // ── Icons — social providers ──────────────────────────────────────────────
  /// Official four-colour Google "G" mark (brand asset — render unrecoloured).
  static const String kSocialGoogle = 'resources/icons/social/google.svg';

  // ── Icons — notifications ─────────────────────────────────────────────────
  static const String kNotifAchievement =
      'resources/icons/notifications/achievement.svg';
  static const String kNotifArrowLeft =
      'resources/icons/notifications/arrow_left.svg';
  static const String kNotifBook = 'resources/icons/notifications/book.svg';
  static const String kNotifCheckMark =
      'resources/icons/notifications/check_mark.svg';
  static const String kNotifClock = 'resources/icons/notifications/clock.svg';
  static const String kNotifClose = 'resources/icons/notifications/close.svg';
  static const String kNotifCreditCard =
      'resources/icons/notifications/credit_card.svg';
  static const String kNotifDelete = 'resources/icons/notifications/delete.svg';
  static const String kNotifFilter = 'resources/icons/notifications/filter.svg';
  static const String kNotifInfo = 'resources/icons/notifications/info.svg';
  static const String kNotifNotificationBell =
      'resources/icons/notifications/notification_bell.svg';
  static const String kNotifSearch = 'resources/icons/notifications/search.svg';
  static const String kNotifSettings =
      'resources/icons/notifications/settings.svg';
  static const String kNotifShield = 'resources/icons/notifications/shield.svg';

  // ── Icons — reports ───────────────────────────────────────────────────────
  static const String kReportsTachometerAverage =
      'resources/icons/reports/tachometer_average.svg';

  // ── Icons — set_study ─────────────────────────────────────────────────────
  static const String kSetStudyAppstoreTwoTone =
      'resources/icons/set_study/appstore_twotone.svg';
  static const String kSetStudyCaretDown =
      'resources/icons/set_study/caret_down.svg';
  static const String kSetStudyChevronDown = kChevronDown; // alias
  static const String kSetStudyChevronDownCircle =
      'resources/icons/set_study/chevron_down_circle.svg';
  static const String kSetStudyDashboardTwoTone =
      'resources/icons/set_study/dashboard_twotone.svg';

  // ── Icons — study_planner ─────────────────────────────────────────────────
  // PNG, not SVG — the exported SVG renders incorrectly in flutter_svg.
  static const String kPlanReadOutlined =
      'resources/icons/study_planner/read_outlined.png';
  // Rotate 180° (turns: 0.5) for the collapsed/down state.
  static const String kUpOutlined =
      'resources/icons/study_planner/up_outlined.svg';

  // ── Icons — study_screen ──────────────────────────────────────────────────
  static const String kStudyCaretLeft =
      'resources/icons/study_screen/caret_left.svg';
  static const String kStudyCaretRight =
      'resources/icons/study_screen/caret_right.svg';
  static const String kStudyClockCircle =
      'resources/icons/study_screen/clock_circle.svg';
  static const String kStudyCopyTwotone =
      'resources/icons/study_screen/copy_twotone.svg';
  static const String kStudyDislikeFilled =
      'resources/icons/study_screen/dislike_filled.svg';
  static const String kStudyDislikeOutline =
      'resources/icons/study_screen/dislike_outline.svg';
  static const String kStudyDot = 'resources/icons/study_screen/dot.svg';
  static const String kStudyDoubleCaretLeft =
      'resources/icons/study_screen/double_caret_left.svg';
  static const String kStudyDoubleCaretRight =
      'resources/icons/study_screen/double_caret_right.svg';
  static const String kStudyEllipsis = kMoreOutlined; // alias
  static const String kStudyEye = 'resources/icons/study_screen/eye.svg';
  static const String kStudyFlag = 'resources/icons/study_screen/flag.svg';
  static const String kStudyFlagFilled =
      'resources/icons/study_screen/flag_filled.svg';
  static const String kStudyFullscreen =
      'resources/icons/study_screen/fullscreen.svg';
  static const String kStudyLikeFilled =
      'resources/icons/study_screen/like_filled.svg';
  static const String kStudyLikeOutline =
      'resources/icons/study_screen/like_outline.svg';
  static const String kStudyMenuUnfold =
      'resources/icons/study_screen/menu_unfold.svg';
  static const String kStudyMessage =
      'resources/icons/study_screen/message.svg';
  static const String kStudyPushpin =
      'resources/icons/study_screen/pushpin.svg';
  static const String kStudySend = 'resources/icons/study_screen/send.svg';
  static const String kStudyStop = 'resources/icons/study_screen/stop.svg';
  static const String kStudyStopFilled =
      'resources/icons/study_screen/stop_filled.svg';
  static const String kStudyVerified =
      'resources/icons/study_screen/verified.svg';

  // ── Animations ────────────────────────────────────────────────────────────
  static const String kSplashAnimation = 'resources/animations/splash.json';

  // ── Images — eshop ────────────────────────────────────────────────────────
  static const String kEshopEmptyIllustration =
      'resources/images/eshop/eshop_empty.svg';
  static const String kEshopFailIllustration =
      'resources/images/eshop/eshop_fail.svg';
  static const String kEshopHeroIllustration =
      'resources/images/eshop/eshop_hero.svg';
  static const String kEshopSuccessIllustration =
      'resources/images/eshop/eshop_success.svg';

  // ── Images — onboarding (3 slides, Figma 71:256 / 71:188 / 71:221) ─────────
  static const String onboardingSlide1 =
      'resources/images/onboarding/slide_1.png';
  static const String onboardingSlide2 =
      'resources/images/onboarding/slide_2.png';
  static const String onboardingSlide3 =
      'resources/images/onboarding/slide_3.png';

  static const List<String> onboardingSlides = [
    onboardingSlide1,
    onboardingSlide2,
    onboardingSlide3,
  ];

  // ── Images — home loan-type icons (Figma 100:1503) ─────────────────────────
  static const String homeIconPersonal = 'resources/images/home/personal.png';
  static const String homeIconMortgage = 'resources/images/home/mortgage.png';
  static const String homeIconCar = 'resources/images/home/car.png';
  static const String homeIconBusiness = 'resources/images/home/business.png';
}
