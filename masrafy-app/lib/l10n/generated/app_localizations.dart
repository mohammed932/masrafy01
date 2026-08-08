import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale) : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate = _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates = <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en')
  ];

  /// Backend OTP_INVALID error code
  ///
  /// In ar, this message translates to:
  /// **'الرمز غير صحيح. حاول مرة أخرى.'**
  String get auth_otp_invalid;

  /// Backend OTP_EXPIRED error code
  ///
  /// In ar, this message translates to:
  /// **'انتهت صلاحية الرمز. اطلب رمزًا جديدًا.'**
  String get auth_otp_expired;

  /// Backend OTP_CONSUMED error code
  ///
  /// In ar, this message translates to:
  /// **'تم استخدام هذا الرمز بالفعل.'**
  String get auth_otp_consumed;

  /// Backend OTP_ATTEMPTS_EXCEEDED error code
  ///
  /// In ar, this message translates to:
  /// **'عدد المحاولات الخاطئة كبير. اطلب رمزًا جديدًا.'**
  String get auth_otp_attempts_exceeded;

  /// Backend OTP_RATE_LIMITED error code
  ///
  /// In ar, this message translates to:
  /// **'طلبات كثيرة. انتظر قليلاً وحاول مجددًا.'**
  String get auth_otp_rate_limited;

  /// Backend OTP_PURPOSE_LOGIN_FORBIDDEN error code
  ///
  /// In ar, this message translates to:
  /// **'لا حاجة لرمز SMS لتسجيل الدخول. استخدم كلمة المرور.'**
  String get auth_otp_purpose_login_forbidden;

  /// Backend CUSTOMER_PHONE_ALREADY_REGISTERED error code
  ///
  /// In ar, this message translates to:
  /// **'هذا الرقم مسجل بالفعل. برجاء تسجيل الدخول.'**
  String get auth_phone_already_registered;

  /// Backend VERIFIED_MOBILE_TOKEN_INVALID error code
  ///
  /// In ar, this message translates to:
  /// **'رمز التحقق غير صالح. ابدأ التسجيل من جديد.'**
  String get auth_verified_mobile_token_invalid;

  /// Backend VERIFIED_MOBILE_TOKEN_EXPIRED error code
  ///
  /// In ar, this message translates to:
  /// **'انتهت صلاحية رمز التحقق. ابدأ التسجيل من جديد.'**
  String get auth_verified_mobile_token_expired;

  /// Backend VERIFIED_MOBILE_TOKEN_CONSUMED error code
  ///
  /// In ar, this message translates to:
  /// **'تم استخدام رمز التحقق بالفعل.'**
  String get auth_verified_mobile_token_consumed;

  /// Backend SOCIAL_TOKEN_INVALID error code
  ///
  /// In ar, this message translates to:
  /// **'فشل تسجيل الدخول. حاول مرة أخرى.'**
  String get auth_social_token_invalid;

  /// Backend SOCIAL_TOKEN_EXPIRED error code
  ///
  /// In ar, this message translates to:
  /// **'انتهت جلسة تسجيل الدخول. حاول مرة أخرى.'**
  String get auth_social_token_expired;

  /// Backend SOCIAL_PROVIDER_UNAVAILABLE error code
  ///
  /// In ar, this message translates to:
  /// **'خدمة تسجيل الدخول غير متاحة مؤقتًا.'**
  String get auth_social_provider_unavailable;

  /// Backend SOCIAL_SESSION_INVALID error code
  ///
  /// In ar, this message translates to:
  /// **'جلسة تسجيل الدخول غير صالحة.'**
  String get auth_social_session_invalid;

  /// Backend SOCIAL_SESSION_EXPIRED error code
  ///
  /// In ar, this message translates to:
  /// **'انتهت جلسة تسجيل الدخول. اضغط زر مزود الخدمة مجددًا.'**
  String get auth_social_session_expired;

  /// Backend SOCIAL_SESSION_CONSUMED error code
  ///
  /// In ar, this message translates to:
  /// **'تم استخدام جلسة تسجيل الدخول بالفعل.'**
  String get auth_social_session_consumed;

  /// Backend ACCOUNT_LOCKED error code
  ///
  /// In ar, this message translates to:
  /// **'تم قفل الحساب مؤقتًا بسبب محاولات فاشلة كثيرة. حاول لاحقًا.'**
  String get auth_account_locked;

  /// Backend PASSWORD_NOT_SET error code
  ///
  /// In ar, this message translates to:
  /// **'لا توجد كلمة مرور لهذا الحساب. سجل الدخول عبر Google.'**
  String get auth_password_not_set;

  /// Backend PASSWORD_SAME_AS_OLD error code
  ///
  /// In ar, this message translates to:
  /// **'اختر كلمة مرور مختلفة عن الحالية.'**
  String get auth_password_same_as_old;

  /// Backend PROFILE_INCOMPLETE error code
  ///
  /// In ar, this message translates to:
  /// **'أكمل بيانات حسابك للمتابعة.'**
  String get auth_profile_incomplete;

  /// Backend PROFILE_FIELD_IMMUTABLE error code
  ///
  /// In ar, this message translates to:
  /// **'لا يمكن تعديل هذا الحقل بعد ضبطه.'**
  String get auth_profile_field_immutable;

  /// Backend PROFILE_ID_DOCS_MISSING error code
  ///
  /// In ar, this message translates to:
  /// **'ارفع وجهي بطاقة الرقم القومي قبل إكمال ملفك.'**
  String get auth_profile_id_docs_missing;

  /// Backend NATIONAL_ID_REQUIRED error code
  ///
  /// In ar, this message translates to:
  /// **'ارفع بطاقة الرقم القومي (الوجه والظهر) قبل التقديم على القرض.'**
  String get auth_national_id_required;

  /// Backend PASSWORD_REQUIRED_FOR_PHONE_PROFILE error code
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور مطلوبة لإكمال ملفك.'**
  String get auth_password_required_for_phone_profile;

  /// Backend PASSWORD_FORBIDDEN_FOR_SOCIAL_PROFILE error code
  ///
  /// In ar, this message translates to:
  /// **'حسابات Google لا تستخدم كلمة مرور.'**
  String get auth_password_forbidden_for_social_profile;

  /// Backend PHONE_MUTATION_ON_PHONE_CUSTOMER_FORBIDDEN error code
  ///
  /// In ar, this message translates to:
  /// **'رقم الجوال مضبوط بالفعل على هذا الحساب.'**
  String get auth_phone_mutation_on_phone_customer_forbidden;

  /// Backend PASSWORD_CHANGE_FORBIDDEN_FOR_SOCIAL error code
  ///
  /// In ar, this message translates to:
  /// **'تغيير كلمة المرور غير متاح لحسابات Google.'**
  String get auth_password_change_forbidden_for_social;

  /// Backend AGE_INVALID error code
  ///
  /// In ar, this message translates to:
  /// **'العمر يجب أن يكون بين 18 و80 سنة.'**
  String get auth_age_invalid;

  /// Backend DOCUMENTS_MISSING error code
  ///
  /// In ar, this message translates to:
  /// **'كلا وجهي بطاقة الرقم القومي مطلوبان.'**
  String get auth_documents_missing;

  /// Backend DOCUMENTS_NOT_OWNED error code
  ///
  /// In ar, this message translates to:
  /// **'هذه المستندات لا تخص حسابك.'**
  String get auth_documents_not_owned;

  /// Backend BANK_PROGRAM_INVALID error code
  ///
  /// In ar, this message translates to:
  /// **'هذا العرض لم يعد متاحًا لملفك.'**
  String get auth_bank_program_invalid;

  /// App brand name shown on the landing screen
  ///
  /// In ar, this message translates to:
  /// **'مصرفي'**
  String get auth_landing_brand;

  /// Landing CTA — phone signup
  ///
  /// In ar, this message translates to:
  /// **'إنشاء حساب بالهاتف'**
  String get auth_landing_action_phone_signup;

  /// Landing CTA — Google sign-in
  ///
  /// In ar, this message translates to:
  /// **'المتابعة باستخدام Google'**
  String get auth_landing_action_google;

  /// Landing — existing-user log in link
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الدخول'**
  String get auth_landing_action_login;

  /// Login screen — app bar title
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الدخول'**
  String get auth_login_title;

  /// Login — mobile number field label
  ///
  /// In ar, this message translates to:
  /// **'رقم الموبايل'**
  String get auth_login_field_mobile;

  /// Login — password field label
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور'**
  String get auth_login_field_password;

  /// Login — submit button
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الدخول'**
  String get auth_login_action_submit;

  /// Login — forgot-password link
  ///
  /// In ar, this message translates to:
  /// **'نسيت كلمة المرور؟'**
  String get auth_login_action_forgot;

  /// Forgot-password — phone-entry app bar title
  ///
  /// In ar, this message translates to:
  /// **'استرداد كلمة المرور'**
  String get auth_forgot_password_title_request;

  /// Forgot-password — OTP app bar title
  ///
  /// In ar, this message translates to:
  /// **'التحقق من الكود'**
  String get auth_forgot_password_title_verify;

  /// Forgot-password — new-password app bar title
  ///
  /// In ar, this message translates to:
  /// **'كلمة مرور جديدة'**
  String get auth_forgot_password_title_reset;

  /// Forgot-password — mobile field label
  ///
  /// In ar, this message translates to:
  /// **'رقم الموبايل'**
  String get auth_forgot_password_field_mobile;

  /// Forgot-password — OTP field label
  ///
  /// In ar, this message translates to:
  /// **'كود مكون من 6 أرقام'**
  String get auth_forgot_password_field_otp;

  /// Forgot-password — new-password field label
  ///
  /// In ar, this message translates to:
  /// **'كلمة مرور جديدة'**
  String get auth_forgot_password_field_new_password;

  /// Forgot-password — confirm-password field label
  ///
  /// In ar, this message translates to:
  /// **'تأكيد كلمة المرور الجديدة'**
  String get auth_forgot_password_field_confirm_password;

  /// Forgot-password — send-OTP button
  ///
  /// In ar, this message translates to:
  /// **'إرسال الكود'**
  String get auth_forgot_password_action_send;

  /// Forgot-password — verify-OTP button
  ///
  /// In ar, this message translates to:
  /// **'تحقق'**
  String get auth_forgot_password_action_verify;

  /// Forgot-password — reset password button
  ///
  /// In ar, this message translates to:
  /// **'إعادة تعيين كلمة المرور'**
  String get auth_forgot_password_action_reset;

  /// Password validation — minimum length
  ///
  /// In ar, this message translates to:
  /// **'8 أحرف على الأقل'**
  String get auth_forgot_password_validation_password_min;

  /// Password validation — at least one letter
  ///
  /// In ar, this message translates to:
  /// **'حرف واحد على الأقل'**
  String get auth_forgot_password_validation_password_letter;

  /// Password validation — at least one digit
  ///
  /// In ar, this message translates to:
  /// **'رقم واحد على الأقل'**
  String get auth_forgot_password_validation_password_digit;

  /// Password validation — confirm does not match
  ///
  /// In ar, this message translates to:
  /// **'غير متطابقة'**
  String get auth_forgot_password_validation_password_mismatch;

  /// Phone signup — step 1 app bar title
  ///
  /// In ar, this message translates to:
  /// **'إنشاء حساب — الموبايل'**
  String get auth_phone_signup_title_phone;

  /// Phone signup — OTP step app bar title
  ///
  /// In ar, this message translates to:
  /// **'التحقق من الكود'**
  String get auth_phone_signup_title_verify;

  /// Phone signup — profile step app bar title
  ///
  /// In ar, this message translates to:
  /// **'بياناتك'**
  String get auth_phone_signup_title_details;

  /// Phone signup — mobile field label
  ///
  /// In ar, this message translates to:
  /// **'رقم الموبايل'**
  String get auth_phone_signup_field_mobile;

  /// Phone signup — mobile field hint (E.164 example)
  ///
  /// In ar, this message translates to:
  /// **'01001234567'**
  String get auth_phone_signup_field_mobile_hint;

  /// Phone signup — OTP field label
  ///
  /// In ar, this message translates to:
  /// **'كود مكون من 6 أرقام'**
  String get auth_phone_signup_field_otp;

  /// Phone signup — full-name field label
  ///
  /// In ar, this message translates to:
  /// **'الاسم بالكامل'**
  String get auth_phone_signup_field_name;

  /// Phone signup — email field label
  ///
  /// In ar, this message translates to:
  /// **'البريد الإلكتروني'**
  String get auth_phone_signup_field_email;

  /// Phone signup — password field label
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور'**
  String get auth_phone_signup_field_password;

  /// Phone signup — confirm-password field label
  ///
  /// In ar, this message translates to:
  /// **'تأكيد كلمة المرور'**
  String get auth_phone_signup_field_password_confirm;

  /// Phone signup — age field label
  ///
  /// In ar, this message translates to:
  /// **'العمر'**
  String get auth_phone_signup_field_age;

  /// Phone signup — send-OTP button
  ///
  /// In ar, this message translates to:
  /// **'إرسال الكود'**
  String get auth_phone_signup_action_send;

  /// Phone signup — verify-OTP button
  ///
  /// In ar, this message translates to:
  /// **'تحقق'**
  String get auth_phone_signup_action_verify;

  /// Phone signup — create-account button
  ///
  /// In ar, this message translates to:
  /// **'إنشاء الحساب'**
  String get auth_phone_signup_action_create;

  /// Validation — field is required
  ///
  /// In ar, this message translates to:
  /// **'مطلوب'**
  String get auth_phone_signup_validation_required;

  /// Validation — email format invalid
  ///
  /// In ar, this message translates to:
  /// **'بريد إلكتروني غير صالح'**
  String get auth_phone_signup_validation_email_invalid;

  /// Password validation — minimum length
  ///
  /// In ar, this message translates to:
  /// **'8 أحرف على الأقل'**
  String get auth_phone_signup_validation_password_min;

  /// Password validation — at least one letter
  ///
  /// In ar, this message translates to:
  /// **'حرف واحد على الأقل'**
  String get auth_phone_signup_validation_password_letter;

  /// Password validation — at least one digit
  ///
  /// In ar, this message translates to:
  /// **'رقم واحد على الأقل'**
  String get auth_phone_signup_validation_password_digit;

  /// Password validation — confirm does not match
  ///
  /// In ar, this message translates to:
  /// **'غير متطابقة'**
  String get auth_phone_signup_validation_password_mismatch;

  /// Age validation — must be 18..80
  ///
  /// In ar, this message translates to:
  /// **'من 18 إلى 80'**
  String get auth_phone_signup_validation_age_range;

  /// Complete-profile gate — dialog title
  ///
  /// In ar, this message translates to:
  /// **'أكمل ملفك الشخصي'**
  String get auth_complete_profile_title;

  /// Complete-profile gate — dialog body
  ///
  /// In ar, this message translates to:
  /// **'نحتاج لبعض البيانات الإضافية قبل التقديم. هذه البيانات مطلوبة من البنك.'**
  String get auth_complete_profile_body;

  /// Complete-profile gate — cancel apply flow
  ///
  /// In ar, this message translates to:
  /// **'إلغاء'**
  String get auth_complete_profile_action_cancel;

  /// Complete-profile gate — continue to complete profile
  ///
  /// In ar, this message translates to:
  /// **'إكمال الملف'**
  String get auth_complete_profile_action_complete;

  /// Complete-profile step 1 — mobile entry app bar title
  ///
  /// In ar, this message translates to:
  /// **'إكمال الملف — الموبايل'**
  String get auth_complete_profile_title_mobile;

  /// Complete-profile step 2 — OTP app bar title
  ///
  /// In ar, this message translates to:
  /// **'التحقق من الكود'**
  String get auth_complete_profile_title_verify;

  /// Complete-profile step 3 — email app bar title
  ///
  /// In ar, this message translates to:
  /// **'البريد الإلكتروني'**
  String get auth_complete_profile_title_email;

  /// Complete-profile step 4 — age app bar title
  ///
  /// In ar, this message translates to:
  /// **'العمر'**
  String get auth_complete_profile_title_age;

  /// Complete-profile — mobile field label
  ///
  /// In ar, this message translates to:
  /// **'رقم الموبايل'**
  String get auth_complete_profile_field_mobile;

  /// Complete-profile — OTP field label
  ///
  /// In ar, this message translates to:
  /// **'كود مكون من 6 أرقام'**
  String get auth_complete_profile_field_otp;

  /// Complete-profile — email field label
  ///
  /// In ar, this message translates to:
  /// **'البريد الإلكتروني'**
  String get auth_complete_profile_field_email;

  /// Complete-profile — age field label with valid range
  ///
  /// In ar, this message translates to:
  /// **'العمر (18–80)'**
  String get auth_complete_profile_field_age;

  /// Complete-profile — send-OTP button
  ///
  /// In ar, this message translates to:
  /// **'إرسال الكود'**
  String get auth_complete_profile_action_send;

  /// Complete-profile — verify-OTP button
  ///
  /// In ar, this message translates to:
  /// **'تحقق'**
  String get auth_complete_profile_action_verify;

  /// Complete-profile — continue to next step
  ///
  /// In ar, this message translates to:
  /// **'متابعة'**
  String get auth_complete_profile_action_continue;

  /// Backend QUESTIONNAIRE_NOT_PUBLISHED error code
  ///
  /// In ar, this message translates to:
  /// **'الاستبيان غير متاح حاليًا. حاول لاحقًا.'**
  String get match_questionnaire_not_published;

  /// Backend UNKNOWN_QUESTION_CODE error code
  ///
  /// In ar, this message translates to:
  /// **'إجاباتك قديمة. أعد بدء الاستبيان.'**
  String get match_unknown_question_code;

  /// Backend UNKNOWN_OPTION_CODE error code
  ///
  /// In ar, this message translates to:
  /// **'إجاباتك قديمة. أعد بدء الاستبيان.'**
  String get match_unknown_option_code;

  /// Backend PROGRAM_NO_LONGER_MATCHES error code
  ///
  /// In ar, this message translates to:
  /// **'هذا العرض لم يعد متاحًا لإجاباتك.'**
  String get match_program_no_longer_matches;

  /// Backend PROGRAM_NAME_KEY_UNKNOWN error code
  ///
  /// In ar, this message translates to:
  /// **'هذا البرنامج لم يعد متاحًا. اختر برنامجًا آخر.'**
  String get match_program_name_key_unknown;

  /// Backend PROGRAM_NAME_KEY_NOT_IN_CATEGORY error code
  ///
  /// In ar, this message translates to:
  /// **'هذا البرنامج غير متاح لهذا النوع من التمويل. اختر برنامجًا آخر.'**
  String get match_program_name_not_in_category;

  /// Dynamic questionnaire form — app bar title
  ///
  /// In ar, this message translates to:
  /// **'أخبرنا عن قرضك'**
  String get questionnaire_form_title;

  /// Dynamic questionnaire form — submit button that triggers the matching preview
  ///
  /// In ar, this message translates to:
  /// **'عرض النتائج المطابقة'**
  String get questionnaire_form_action_submit;

  /// Matching preview — app bar title
  ///
  /// In ar, this message translates to:
  /// **'النتائج المطابقة لك'**
  String get match_preview_title;

  /// Matching preview — empty-state message when no programs match
  ///
  /// In ar, this message translates to:
  /// **'لا توجد برامج تطابق إجاباتك بعد. حاول تعديلها.'**
  String get match_preview_no_matches;

  /// Matching preview — suggestions section header
  ///
  /// In ar, this message translates to:
  /// **'طرق لفتح المزيد من العروض'**
  String get match_preview_section_suggestions;

  /// Match card — required-documents list header
  ///
  /// In ar, this message translates to:
  /// **'المستندات المطلوبة'**
  String get match_preview_required_documents;

  /// Match card — rejection-reasons list header for an ineligible program
  ///
  /// In ar, this message translates to:
  /// **'سبب عدم الأهلية'**
  String get match_preview_rejection_reasons;

  /// Match card — monthly installment metric label
  ///
  /// In ar, this message translates to:
  /// **'القسط الشهري'**
  String get match_preview_monthly_installment;

  /// Match card — effective interest rate metric label
  ///
  /// In ar, this message translates to:
  /// **'الفائدة الفعلية'**
  String get match_preview_effective_rate;

  /// Suggestion tile — how many more programs an answer change unlocks
  ///
  /// In ar, this message translates to:
  /// **'{count, plural, =0{قد يساعد تعديل هذه الإجابة} =1{يفتح برنامجًا إضافيًا واحدًا} =2{يفتح برنامجين إضافيين} few{يفتح {count} برامج إضافية} many{يفتح {count} برنامجًا إضافيًا} other{يفتح {count} برنامج إضافي}}'**
  String match_preview_suggestion_unlock(int count);

  /// Match card — featured-program badge
  ///
  /// In ar, this message translates to:
  /// **'مميز'**
  String get match_featured_badge;

  /// Match card — approval tier: excellent
  ///
  /// In ar, this message translates to:
  /// **'فرصة ممتازة'**
  String get match_tier_excellent;

  /// Match card — approval tier: good
  ///
  /// In ar, this message translates to:
  /// **'فرصة جيدة'**
  String get match_tier_good;

  /// Match card — approval tier: moderate
  ///
  /// In ar, this message translates to:
  /// **'فرصة متوسطة'**
  String get match_tier_moderate;

  /// Match card — approval tier: low
  ///
  /// In ar, this message translates to:
  /// **'فرصة منخفضة'**
  String get match_tier_low;

  /// Match card — approval tier: very low
  ///
  /// In ar, this message translates to:
  /// **'فرصة منخفضة جدًا'**
  String get match_tier_very_low;

  /// Match card — approval tier: unknown/estimated
  ///
  /// In ar, this message translates to:
  /// **'تقدير غير محدد'**
  String get match_tier_unknown;

  /// Generic retry action
  ///
  /// In ar, this message translates to:
  /// **'إعادة المحاولة'**
  String get match_action_retry;

  /// Generic non-specific failure message
  ///
  /// In ar, this message translates to:
  /// **'حدث خطأ ما. حاول مرة أخرى.'**
  String get match_generic_error;

  /// Network-unreachable failure message
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد اتصال. تحقق من الشبكة وحاول مجددًا.'**
  String get match_network_error;

  /// Empty-result action — go back to edit answers
  ///
  /// In ar, this message translates to:
  /// **'تعديل إجاباتي'**
  String get match_preview_adjust_answers;

  /// Hint shown when submit is disabled
  ///
  /// In ar, this message translates to:
  /// **'أجب عن جميع الأسئلة المطلوبة لعرض العروض.'**
  String get questionnaire_form_submit_hint;

  /// Money amount with EGP currency suffix
  ///
  /// In ar, this message translates to:
  /// **'{value} ج.م'**
  String match_amount_egp(String value);

  /// Percentage value
  ///
  /// In ar, this message translates to:
  /// **'{value}٪'**
  String match_rate_percent(String value);

  /// No description provided for @common_coming_soon.
  ///
  /// In ar, this message translates to:
  /// **'قريبًا'**
  String get common_coming_soon;

  /// No description provided for @error_invalid_credentials.
  ///
  /// In ar, this message translates to:
  /// **'رقم الهاتف أو كلمة المرور غير صحيحة.'**
  String get error_invalid_credentials;

  /// No description provided for @error_network.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد اتصال. تحقق من الشبكة وحاول مجددًا.'**
  String get error_network;

  /// No description provided for @error_generic.
  ///
  /// In ar, this message translates to:
  /// **'حدث خطأ ما. حاول مرة أخرى.'**
  String get error_generic;

  /// No description provided for @error_rate_limited.
  ///
  /// In ar, this message translates to:
  /// **'محاولات كثيرة. انتظر قليلاً وحاول مجددًا.'**
  String get error_rate_limited;

  /// No description provided for @onboarding_slide1_title.
  ///
  /// In ar, this message translates to:
  /// **'اكتشف عروض قروض مصمّمة لك.'**
  String get onboarding_slide1_title;

  /// No description provided for @onboarding_slide1_body.
  ///
  /// In ar, this message translates to:
  /// **'نبحث في عدة بنوك رائدة لإيجاد أفضل الأسعار والشروط المناسبة لملفك تحديدًا.'**
  String get onboarding_slide1_body;

  /// No description provided for @onboarding_slide2_title.
  ///
  /// In ar, this message translates to:
  /// **'قارن العروض في ثوانٍ.'**
  String get onboarding_slide2_title;

  /// No description provided for @onboarding_slide2_body.
  ///
  /// In ar, this message translates to:
  /// **'قروض شخصية وسيارات وعقارية وأعمال — جنبًا إلى جنب، بأسعار وحدود واضحة.'**
  String get onboarding_slide2_body;

  /// No description provided for @onboarding_slide3_title.
  ///
  /// In ar, this message translates to:
  /// **'تقدّم بثقة.'**
  String get onboarding_slide3_title;

  /// No description provided for @onboarding_slide3_body.
  ///
  /// In ar, this message translates to:
  /// **'نطابقك مع العروض، ثم تتقدّم للعرض الأنسب لك. مجاني لك دائمًا.'**
  String get onboarding_slide3_body;

  /// No description provided for @onboarding_next.
  ///
  /// In ar, this message translates to:
  /// **'التالي'**
  String get onboarding_next;

  /// No description provided for @onboarding_skip.
  ///
  /// In ar, this message translates to:
  /// **'تخطّي'**
  String get onboarding_skip;

  /// No description provided for @onboarding_signin.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الدخول'**
  String get onboarding_signin;

  /// No description provided for @onboarding_or_continue.
  ///
  /// In ar, this message translates to:
  /// **'أو تابع باستخدام'**
  String get onboarding_or_continue;

  /// No description provided for @onboarding_google.
  ///
  /// In ar, this message translates to:
  /// **'Google'**
  String get onboarding_google;

  /// No description provided for @onboarding_lang_toggle.
  ///
  /// In ar, this message translates to:
  /// **'English'**
  String get onboarding_lang_toggle;

  /// No description provided for @login_title.
  ///
  /// In ar, this message translates to:
  /// **'سجّل الدخول إلى حسابك'**
  String get login_title;

  /// No description provided for @login_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'سجّل الدخول لاكتشاف أفضل عروض القروض'**
  String get login_subtitle;

  /// No description provided for @login_identifier_label.
  ///
  /// In ar, this message translates to:
  /// **'البريد الإلكتروني'**
  String get login_identifier_label;

  /// No description provided for @login_identifier_hint.
  ///
  /// In ar, this message translates to:
  /// **'ahmed@masrafy.io'**
  String get login_identifier_hint;

  /// No description provided for @login_password_label.
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور'**
  String get login_password_label;

  /// No description provided for @login_password_hint.
  ///
  /// In ar, this message translates to:
  /// **'أدخل كلمة المرور'**
  String get login_password_hint;

  /// No description provided for @login_forgot.
  ///
  /// In ar, this message translates to:
  /// **'هل نسيت كلمة المرور؟'**
  String get login_forgot;

  /// No description provided for @login_cta.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الدخول'**
  String get login_cta;

  /// No description provided for @login_or_continue.
  ///
  /// In ar, this message translates to:
  /// **'أو تابع باستخدام'**
  String get login_or_continue;

  /// No description provided for @login_google.
  ///
  /// In ar, this message translates to:
  /// **'Google'**
  String get login_google;

  /// No description provided for @login_no_account.
  ///
  /// In ar, this message translates to:
  /// **'ليس لديك حساب؟'**
  String get login_no_account;

  /// No description provided for @login_create_account.
  ///
  /// In ar, this message translates to:
  /// **'إنشاء حساب'**
  String get login_create_account;

  /// No description provided for @login_terms.
  ///
  /// In ar, this message translates to:
  /// **'بالتسجيل، أنت توافق على شروط الخدمة'**
  String get login_terms;

  /// No description provided for @signup_title.
  ///
  /// In ar, this message translates to:
  /// **'أنشئ حسابك'**
  String get signup_title;

  /// No description provided for @signup_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'سجّل لاكتشاف أفضل عروض القروض'**
  String get signup_subtitle;

  /// No description provided for @signup_photo_upload.
  ///
  /// In ar, this message translates to:
  /// **'رفع'**
  String get signup_photo_upload;

  /// No description provided for @signup_first_name_label.
  ///
  /// In ar, this message translates to:
  /// **'الاسم الأول'**
  String get signup_first_name_label;

  /// No description provided for @signup_first_name_hint.
  ///
  /// In ar, this message translates to:
  /// **'محمد'**
  String get signup_first_name_hint;

  /// No description provided for @signup_last_name_label.
  ///
  /// In ar, this message translates to:
  /// **'اسم العائلة'**
  String get signup_last_name_label;

  /// No description provided for @signup_last_name_hint.
  ///
  /// In ar, this message translates to:
  /// **'إسكندر'**
  String get signup_last_name_hint;

  /// No description provided for @signup_phone_label.
  ///
  /// In ar, this message translates to:
  /// **'رقم الهاتف'**
  String get signup_phone_label;

  /// No description provided for @signup_phone_hint.
  ///
  /// In ar, this message translates to:
  /// **'101 234 5678'**
  String get signup_phone_hint;

  /// No description provided for @signup_email_label.
  ///
  /// In ar, this message translates to:
  /// **'البريد الإلكتروني'**
  String get signup_email_label;

  /// No description provided for @signup_email_hint.
  ///
  /// In ar, this message translates to:
  /// **'ahmed@example.com'**
  String get signup_email_hint;

  /// No description provided for @signup_dob_label.
  ///
  /// In ar, this message translates to:
  /// **'تاريخ الميلاد'**
  String get signup_dob_label;

  /// No description provided for @signup_dob_day.
  ///
  /// In ar, this message translates to:
  /// **'اليوم'**
  String get signup_dob_day;

  /// No description provided for @signup_dob_month.
  ///
  /// In ar, this message translates to:
  /// **'الشهر'**
  String get signup_dob_month;

  /// No description provided for @signup_dob_year.
  ///
  /// In ar, this message translates to:
  /// **'السنة'**
  String get signup_dob_year;

  /// No description provided for @signup_dob_hint.
  ///
  /// In ar, this message translates to:
  /// **'اختر تاريخ الميلاد'**
  String get signup_dob_hint;

  /// No description provided for @signup_age_verified.
  ///
  /// In ar, this message translates to:
  /// **'تم التحقق من العمر — {years} سنة'**
  String signup_age_verified(Object years);

  /// No description provided for @signup_password_label.
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور'**
  String get signup_password_label;

  /// No description provided for @signup_password_hint.
  ///
  /// In ar, this message translates to:
  /// **'أنشئ كلمة مرور'**
  String get signup_password_hint;

  /// No description provided for @signup_confirm_password_label.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد كلمة المرور'**
  String get signup_confirm_password_label;

  /// No description provided for @signup_confirm_password_hint.
  ///
  /// In ar, this message translates to:
  /// **'أعد إدخال كلمة المرور'**
  String get signup_confirm_password_hint;

  /// No description provided for @signup_national_id_label.
  ///
  /// In ar, this message translates to:
  /// **'الرقم القومي'**
  String get signup_national_id_label;

  /// No description provided for @signup_national_id_hint.
  ///
  /// In ar, this message translates to:
  /// **'— مطلوب للأهلية للحصول على القرض'**
  String get signup_national_id_hint;

  /// No description provided for @signup_id_front.
  ///
  /// In ar, this message translates to:
  /// **'الوجه الأمامي'**
  String get signup_id_front;

  /// No description provided for @signup_id_back.
  ///
  /// In ar, this message translates to:
  /// **'الوجه الخلفي'**
  String get signup_id_back;

  /// No description provided for @signup_id_tap_to_upload.
  ///
  /// In ar, this message translates to:
  /// **'اضغط للرفع'**
  String get signup_id_tap_to_upload;

  /// No description provided for @signup_terms.
  ///
  /// In ar, this message translates to:
  /// **'أوافق على شروط الخدمة وسياسة الخصوصية الخاصة بمصرفي، وأوافق على معالجة بياناتي المالية.'**
  String get signup_terms;

  /// No description provided for @signup_cta.
  ///
  /// In ar, this message translates to:
  /// **'إنشاء الحساب'**
  String get signup_cta;

  /// No description provided for @signup_have_account.
  ///
  /// In ar, this message translates to:
  /// **'لديك حساب بالفعل؟'**
  String get signup_have_account;

  /// No description provided for @signup_sign_in.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الدخول'**
  String get signup_sign_in;

  /// No description provided for @social_phone_title.
  ///
  /// In ar, this message translates to:
  /// **'أضف رقم هاتفك'**
  String get social_phone_title;

  /// No description provided for @social_phone_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'نحتاج رقم هاتفك لتأمين حسابك. سنرسل لك رمز تحقق.'**
  String get social_phone_subtitle;

  /// No description provided for @social_phone_cta.
  ///
  /// In ar, this message translates to:
  /// **'إرسال رمز التحقق'**
  String get social_phone_cta;

  /// No description provided for @otp_title.
  ///
  /// In ar, this message translates to:
  /// **'تحقّق من رقم هاتفك'**
  String get otp_title;

  /// No description provided for @otp_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'أرسلنا رمزًا من 6 أرقام إلى {destination}. أدخله بالأسفل.'**
  String otp_subtitle(Object destination);

  /// No description provided for @otp_enter_code.
  ///
  /// In ar, this message translates to:
  /// **'أدخل رمز التحقق'**
  String get otp_enter_code;

  /// No description provided for @otp_attempts_left.
  ///
  /// In ar, this message translates to:
  /// **'{count} محاولات متبقية'**
  String otp_attempts_left(Object count);

  /// No description provided for @otp_resend_in.
  ///
  /// In ar, this message translates to:
  /// **'إعادة إرسال الرمز خلال'**
  String get otp_resend_in;

  /// No description provided for @otp_resend_action.
  ///
  /// In ar, this message translates to:
  /// **'إعادة إرسال الرمز'**
  String get otp_resend_action;

  /// No description provided for @otp_expiry_notice.
  ///
  /// In ar, this message translates to:
  /// **'ينتهي هذا الرمز خلال {minutes} دقائق. لا تشاركه مع أحد — لن يطلبه منك مصرفي أبدًا.'**
  String otp_expiry_notice(Object minutes);

  /// No description provided for @otp_verify_cta.
  ///
  /// In ar, this message translates to:
  /// **'تحقّق وتابع'**
  String get otp_verify_cta;

  /// No description provided for @otp_didnt_receive.
  ///
  /// In ar, this message translates to:
  /// **'لم يصلك الرمز؟'**
  String get otp_didnt_receive;

  /// No description provided for @otp_wrong_number.
  ///
  /// In ar, this message translates to:
  /// **'رقم خاطئ؟'**
  String get otp_wrong_number;

  /// No description provided for @otp_change_phone.
  ///
  /// In ar, this message translates to:
  /// **'تغيير الرقم'**
  String get otp_change_phone;

  /// No description provided for @home_title.
  ///
  /// In ar, this message translates to:
  /// **'ما نوع القرض الذي تبحث عنه؟'**
  String get home_title;

  /// No description provided for @home_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'مستشار القروض جاهز لمساعدتك'**
  String get home_subtitle;

  /// No description provided for @home_loan_types.
  ///
  /// In ar, this message translates to:
  /// **'أنواع القروض'**
  String get home_loan_types;

  /// Home — catalog program-name picker above the Continue CTA
  ///
  /// In ar, this message translates to:
  /// **'برنامج التمويل'**
  String get home_program_label;

  /// Home — program picker placeholder when nothing is picked yet
  ///
  /// In ar, this message translates to:
  /// **'اختر البرنامج'**
  String get home_program_hint;

  /// Home — search placeholder inside the program select sheet
  ///
  /// In ar, this message translates to:
  /// **'ابحث عن برنامج'**
  String get home_program_search_hint;

  /// No description provided for @home_continue.
  ///
  /// In ar, this message translates to:
  /// **'متابعة'**
  String get home_continue;

  /// No description provided for @home_support_label.
  ///
  /// In ar, this message translates to:
  /// **'الدعم'**
  String get home_support_label;

  /// No description provided for @home_support_title.
  ///
  /// In ar, this message translates to:
  /// **'اسأل مصرفي عن أي شيء'**
  String get home_support_title;

  /// No description provided for @home_nav_loans.
  ///
  /// In ar, this message translates to:
  /// **'قروضي'**
  String get home_nav_loans;

  /// No description provided for @home_nav_home.
  ///
  /// In ar, this message translates to:
  /// **'الرئيسية'**
  String get home_nav_home;

  /// No description provided for @home_nav_menu.
  ///
  /// In ar, this message translates to:
  /// **'الحساب'**
  String get home_nav_menu;

  /// No description provided for @account_title.
  ///
  /// In ar, this message translates to:
  /// **'الحساب'**
  String get account_title;

  /// No description provided for @account_row_profile.
  ///
  /// In ar, this message translates to:
  /// **'حسابي'**
  String get account_row_profile;

  /// No description provided for @account_row_settings_security.
  ///
  /// In ar, this message translates to:
  /// **'الإعدادات والأمان'**
  String get account_row_settings_security;

  /// No description provided for @account_row_saved_offers.
  ///
  /// In ar, this message translates to:
  /// **'العروض المحفوظة'**
  String get account_row_saved_offers;

  /// No description provided for @account_row_notifications.
  ///
  /// In ar, this message translates to:
  /// **'مركز الإشعارات'**
  String get account_row_notifications;

  /// No description provided for @account_row_previous_applications.
  ///
  /// In ar, this message translates to:
  /// **'الطلبات السابقة'**
  String get account_row_previous_applications;

  /// No description provided for @account_row_logout.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الخروج'**
  String get account_row_logout;

  /// No description provided for @account_logout_confirm_title.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الخروج من مصرفي؟'**
  String get account_logout_confirm_title;

  /// No description provided for @account_logout_confirm_message.
  ///
  /// In ar, this message translates to:
  /// **'سيتم إعادتك إلى شاشة تسجيل الدخول.'**
  String get account_logout_confirm_message;

  /// No description provided for @account_logout_confirm_action.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الخروج'**
  String get account_logout_confirm_action;

  /// No description provided for @account_logout_confirm_cancel.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء'**
  String get account_logout_confirm_cancel;

  /// No description provided for @saved_offers_empty_title.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد عروض محفوظة بعد'**
  String get saved_offers_empty_title;

  /// No description provided for @saved_offers_empty_body.
  ///
  /// In ar, this message translates to:
  /// **'ستظهر هنا العروض التي تحفظها.'**
  String get saved_offers_empty_body;

  /// No description provided for @saved_offers_remove.
  ///
  /// In ar, this message translates to:
  /// **'إزالة'**
  String get saved_offers_remove;

  /// No description provided for @saved_offers_remove_failed.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر إزالة العرض. حاول مرة أخرى.'**
  String get saved_offers_remove_failed;

  /// Backend SAVED_OFFER_NOT_FOUND error code
  ///
  /// In ar, this message translates to:
  /// **'هذا العرض ليس ضمن عروضك المحفوظة.'**
  String get error_saved_offer_not_found;

  /// No description provided for @previous_applications_title.
  ///
  /// In ar, this message translates to:
  /// **'الطلبات'**
  String get previous_applications_title;

  /// No description provided for @previous_applications_empty_title.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد طلبات بعد'**
  String get previous_applications_empty_title;

  /// No description provided for @previous_applications_empty_body.
  ///
  /// In ar, this message translates to:
  /// **'تقدم بطلب لعرض وسيظهر هنا.'**
  String get previous_applications_empty_body;

  /// No description provided for @previous_applications_status_applied.
  ///
  /// In ar, this message translates to:
  /// **'تم التقديم'**
  String get previous_applications_status_applied;

  /// No description provided for @previous_applications_status_approved.
  ///
  /// In ar, this message translates to:
  /// **'تمت الموافقة'**
  String get previous_applications_status_approved;

  /// No description provided for @previous_applications_status_rejected.
  ///
  /// In ar, this message translates to:
  /// **'مرفوض'**
  String get previous_applications_status_rejected;

  /// No description provided for @home_cat_personal.
  ///
  /// In ar, this message translates to:
  /// **'شخصي'**
  String get home_cat_personal;

  /// No description provided for @home_cat_mortgage.
  ///
  /// In ar, this message translates to:
  /// **'عقاري'**
  String get home_cat_mortgage;

  /// No description provided for @home_cat_car.
  ///
  /// In ar, this message translates to:
  /// **'سيارة'**
  String get home_cat_car;

  /// No description provided for @home_cat_business.
  ///
  /// In ar, this message translates to:
  /// **'أعمال'**
  String get home_cat_business;

  /// No description provided for @home_limit_personal.
  ///
  /// In ar, this message translates to:
  /// **'حتى ٢٠٠ ألف ج.م'**
  String get home_limit_personal;

  /// No description provided for @home_limit_mortgage.
  ///
  /// In ar, this message translates to:
  /// **'حتى ٣ مليون ج.م'**
  String get home_limit_mortgage;

  /// No description provided for @home_limit_car.
  ///
  /// In ar, this message translates to:
  /// **'حتى ٢ مليون ج.م'**
  String get home_limit_car;

  /// No description provided for @home_limit_business.
  ///
  /// In ar, this message translates to:
  /// **'حتى ٥ مليون ج.م'**
  String get home_limit_business;

  /// No description provided for @home_apr_personal.
  ///
  /// In ar, this message translates to:
  /// **'من ١١٪ سنويًا'**
  String get home_apr_personal;

  /// No description provided for @home_apr_mortgage.
  ///
  /// In ar, this message translates to:
  /// **'من ٩٫٥٪ سنويًا'**
  String get home_apr_mortgage;

  /// No description provided for @home_apr_car.
  ///
  /// In ar, this message translates to:
  /// **'من ١٠٫٢٪ سنويًا'**
  String get home_apr_car;

  /// No description provided for @home_apr_business.
  ///
  /// In ar, this message translates to:
  /// **'من ١٢٪ سنويًا'**
  String get home_apr_business;

  /// No description provided for @q_common_yes.
  ///
  /// In ar, this message translates to:
  /// **'نعم'**
  String get q_common_yes;

  /// No description provided for @q_common_no.
  ///
  /// In ar, this message translates to:
  /// **'لا'**
  String get q_common_no;

  /// No description provided for @q_common_currency_egp.
  ///
  /// In ar, this message translates to:
  /// **'ج.م'**
  String get q_common_currency_egp;

  /// No description provided for @q_common_save.
  ///
  /// In ar, this message translates to:
  /// **'حفظ'**
  String get q_common_save;

  /// No description provided for @q_common_cancel.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء'**
  String get q_common_cancel;

  /// No description provided for @q_common_search.
  ///
  /// In ar, this message translates to:
  /// **'بحث'**
  String get q_common_search;

  /// No description provided for @q_mortgage_title.
  ///
  /// In ar, this message translates to:
  /// **'طلب تمويل عقاري'**
  String get q_mortgage_title;

  /// No description provided for @q_mortgage_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'سنطابقك مع البنوك المتخصصة في احتياجاتك'**
  String get q_mortgage_subtitle;

  /// No description provided for @q_mortgage_next.
  ///
  /// In ar, this message translates to:
  /// **'التالي'**
  String get q_mortgage_next;

  /// No description provided for @q_mortgage_finish.
  ///
  /// In ar, this message translates to:
  /// **'إنهاء'**
  String get q_mortgage_finish;

  /// No description provided for @q_mortgage_submitted.
  ///
  /// In ar, this message translates to:
  /// **'تم حفظ إجاباتك'**
  String get q_mortgage_submitted;

  /// No description provided for @q_mortgage_step1_title.
  ///
  /// In ar, this message translates to:
  /// **'بيانات العقار والتمويل'**
  String get q_mortgage_step1_title;

  /// No description provided for @q_mortgage_step2_title.
  ///
  /// In ar, this message translates to:
  /// **'الوظيفة والدخل'**
  String get q_mortgage_step2_title;

  /// No description provided for @q_mortgage_step3_title.
  ///
  /// In ar, this message translates to:
  /// **'السجل الائتماني'**
  String get q_mortgage_step3_title;

  /// No description provided for @q_mortgage_step4_title.
  ///
  /// In ar, this message translates to:
  /// **'التفضيلات'**
  String get q_mortgage_step4_title;

  /// No description provided for @q_mortgage_select_hint.
  ///
  /// In ar, this message translates to:
  /// **'اختر'**
  String get q_mortgage_select_hint;

  /// No description provided for @q_mortgage_years.
  ///
  /// In ar, this message translates to:
  /// **'{years} سنة'**
  String q_mortgage_years(Object years);

  /// No description provided for @q_mortgage_q_property_type.
  ///
  /// In ar, this message translates to:
  /// **'ما نوع العقار الذي ترغب في تمويله؟'**
  String get q_mortgage_q_property_type;

  /// No description provided for @q_mortgage_hint_property_type.
  ///
  /// In ar, this message translates to:
  /// **'اختر نوع العقار'**
  String get q_mortgage_hint_property_type;

  /// No description provided for @q_opt_property_apartment.
  ///
  /// In ar, this message translates to:
  /// **'شقة'**
  String get q_opt_property_apartment;

  /// No description provided for @q_opt_property_villa.
  ///
  /// In ar, this message translates to:
  /// **'فيلا'**
  String get q_opt_property_villa;

  /// No description provided for @q_opt_property_duplex.
  ///
  /// In ar, this message translates to:
  /// **'دوبلكس'**
  String get q_opt_property_duplex;

  /// No description provided for @q_opt_property_commercial.
  ///
  /// In ar, this message translates to:
  /// **'محل تجاري'**
  String get q_opt_property_commercial;

  /// No description provided for @q_opt_property_office.
  ///
  /// In ar, this message translates to:
  /// **'مكتب إداري'**
  String get q_opt_property_office;

  /// No description provided for @q_opt_property_other.
  ///
  /// In ar, this message translates to:
  /// **'أخرى'**
  String get q_opt_property_other;

  /// No description provided for @q_mortgage_q_in_compound.
  ///
  /// In ar, this message translates to:
  /// **'هل يقع العقار داخل كمبوند سكني؟'**
  String get q_mortgage_q_in_compound;

  /// No description provided for @q_mortgage_q_registration_status.
  ///
  /// In ar, this message translates to:
  /// **'ما حالة تسجيل العقار؟'**
  String get q_mortgage_q_registration_status;

  /// No description provided for @q_opt_reg_registered.
  ///
  /// In ar, this message translates to:
  /// **'مسجل رسميًا'**
  String get q_opt_reg_registered;

  /// No description provided for @q_opt_reg_eligible.
  ///
  /// In ar, this message translates to:
  /// **'قابل للتسجيل'**
  String get q_opt_reg_eligible;

  /// No description provided for @q_opt_reg_not_registered.
  ///
  /// In ar, this message translates to:
  /// **'غير مسجل'**
  String get q_opt_reg_not_registered;

  /// No description provided for @q_opt_reg_unsure.
  ///
  /// In ar, this message translates to:
  /// **'غير متأكد'**
  String get q_opt_reg_unsure;

  /// No description provided for @q_mortgage_q_address.
  ///
  /// In ar, this message translates to:
  /// **'ما هو عنوان العقار؟'**
  String get q_mortgage_q_address;

  /// No description provided for @q_mortgage_hint_governorate.
  ///
  /// In ar, this message translates to:
  /// **'اختر المحافظة'**
  String get q_mortgage_hint_governorate;

  /// No description provided for @q_mortgage_address_label.
  ///
  /// In ar, this message translates to:
  /// **'العنوان'**
  String get q_mortgage_address_label;

  /// No description provided for @q_mortgage_address_hint.
  ///
  /// In ar, this message translates to:
  /// **'الشارع، المبنى، المنطقة'**
  String get q_mortgage_address_hint;

  /// No description provided for @q_mortgage_q_property_value.
  ///
  /// In ar, this message translates to:
  /// **'ما هي القيمة التقريبية للعقار؟'**
  String get q_mortgage_q_property_value;

  /// No description provided for @q_mortgage_q_down_payment.
  ///
  /// In ar, this message translates to:
  /// **'كم نسبة المقدم المتوفر لديك حاليًا؟ (٪)'**
  String get q_mortgage_q_down_payment;

  /// No description provided for @q_mortgage_hint_down_payment.
  ///
  /// In ar, this message translates to:
  /// **'المقدم'**
  String get q_mortgage_hint_down_payment;

  /// No description provided for @q_opt_dp_under10.
  ///
  /// In ar, this message translates to:
  /// **'أقل من ١٠٪'**
  String get q_opt_dp_under10;

  /// No description provided for @q_opt_dp_10_20.
  ///
  /// In ar, this message translates to:
  /// **'١٠٪ – ٢٠٪'**
  String get q_opt_dp_10_20;

  /// No description provided for @q_opt_dp_20_30.
  ///
  /// In ar, this message translates to:
  /// **'٢٠٪ – ٣٠٪'**
  String get q_opt_dp_20_30;

  /// No description provided for @q_opt_dp_over30.
  ///
  /// In ar, this message translates to:
  /// **'أكثر من ٣٠٪'**
  String get q_opt_dp_over30;

  /// No description provided for @q_mortgage_q_repayment_period.
  ///
  /// In ar, this message translates to:
  /// **'ما مدة السداد المناسبة لك؟'**
  String get q_mortgage_q_repayment_period;

  /// No description provided for @q_mortgage_repayment_label.
  ///
  /// In ar, this message translates to:
  /// **'مدة السداد'**
  String get q_mortgage_repayment_label;

  /// No description provided for @q_mortgage_q_employment.
  ///
  /// In ar, this message translates to:
  /// **'ما هي حالتك الوظيفية؟'**
  String get q_mortgage_q_employment;

  /// No description provided for @q_opt_emp_government.
  ///
  /// In ar, this message translates to:
  /// **'موظف حكومي'**
  String get q_opt_emp_government;

  /// No description provided for @q_opt_emp_private.
  ///
  /// In ar, this message translates to:
  /// **'موظف قطاع خاص'**
  String get q_opt_emp_private;

  /// No description provided for @q_opt_emp_business_owner.
  ///
  /// In ar, this message translates to:
  /// **'صاحب عمل'**
  String get q_opt_emp_business_owner;

  /// No description provided for @q_opt_emp_freelancer.
  ///
  /// In ar, this message translates to:
  /// **'عمل حر'**
  String get q_opt_emp_freelancer;

  /// No description provided for @q_opt_emp_retired.
  ///
  /// In ar, this message translates to:
  /// **'متقاعد'**
  String get q_opt_emp_retired;

  /// No description provided for @q_mortgage_q_income.
  ///
  /// In ar, this message translates to:
  /// **'ما متوسط دخلك الشهري؟'**
  String get q_mortgage_q_income;

  /// No description provided for @q_mortgage_hint_income.
  ///
  /// In ar, this message translates to:
  /// **'الدخل الشهري'**
  String get q_mortgage_hint_income;

  /// No description provided for @q_opt_income_b1.
  ///
  /// In ar, this message translates to:
  /// **'أقل من ٥٠٬٠٠٠ ج.م'**
  String get q_opt_income_b1;

  /// No description provided for @q_opt_income_b2.
  ///
  /// In ar, this message translates to:
  /// **'٥٠٬٠٠٠ – ١٠٠٬٠٠٠ ج.م'**
  String get q_opt_income_b2;

  /// No description provided for @q_opt_income_b3.
  ///
  /// In ar, this message translates to:
  /// **'١٠٠٬٠٠٠ – ٣٠٠٬٠٠٠ ج.م'**
  String get q_opt_income_b3;

  /// No description provided for @q_opt_income_b4.
  ///
  /// In ar, this message translates to:
  /// **'٣٠٠٬٠٠٠ – ٦٠٠٬٠٠٠ ج.م'**
  String get q_opt_income_b4;

  /// No description provided for @q_opt_income_b5.
  ///
  /// In ar, this message translates to:
  /// **'٦٠٠٬٠٠٠ – ١٬٠٠٠٬٠٠٠ ج.م'**
  String get q_opt_income_b5;

  /// No description provided for @q_opt_income_b6.
  ///
  /// In ar, this message translates to:
  /// **'أكثر من ١٬٠٠٠٬٠٠٠ ج.م'**
  String get q_opt_income_b6;

  /// No description provided for @q_mortgage_q_salary_transfer.
  ///
  /// In ar, this message translates to:
  /// **'هل يتم تحويل راتبك إلى حساب بنكي؟'**
  String get q_mortgage_q_salary_transfer;

  /// No description provided for @q_mortgage_q_additional_income.
  ///
  /// In ar, this message translates to:
  /// **'هل لديك مصادر دخل إضافية؟'**
  String get q_mortgage_q_additional_income;

  /// No description provided for @q_mortgage_q_current_loans.
  ///
  /// In ar, this message translates to:
  /// **'هل لديك حاليًا أي قروض أو التزامات مالية؟'**
  String get q_mortgage_q_current_loans;

  /// No description provided for @q_mortgage_q_installments.
  ///
  /// In ar, this message translates to:
  /// **'ما إجمالي قيمة أقساطك الشهرية؟'**
  String get q_mortgage_q_installments;

  /// No description provided for @q_mortgage_installments_label.
  ///
  /// In ar, this message translates to:
  /// **'الأقساط الشهرية'**
  String get q_mortgage_installments_label;

  /// No description provided for @q_mortgage_installments_hint.
  ///
  /// In ar, this message translates to:
  /// **'قيمة القسط الشهري'**
  String get q_mortgage_installments_hint;

  /// No description provided for @q_mortgage_q_prior_rejection.
  ///
  /// In ar, this message translates to:
  /// **'هل سبق ورُفض لك طلب تمويل عقاري؟'**
  String get q_mortgage_q_prior_rejection;

  /// No description provided for @q_mortgage_q_priority.
  ///
  /// In ar, this message translates to:
  /// **'ما الأهم بالنسبة لك في التمويل العقاري؟'**
  String get q_mortgage_q_priority;

  /// No description provided for @q_opt_priority_lowest_installment.
  ///
  /// In ar, this message translates to:
  /// **'أقل قسط شهري'**
  String get q_opt_priority_lowest_installment;

  /// No description provided for @q_opt_priority_longest_period.
  ///
  /// In ar, this message translates to:
  /// **'أطول مدة سداد'**
  String get q_opt_priority_longest_period;

  /// No description provided for @q_opt_priority_lowest_down_payment.
  ///
  /// In ar, this message translates to:
  /// **'أقل مقدم'**
  String get q_opt_priority_lowest_down_payment;

  /// No description provided for @q_opt_priority_fastest_approval.
  ///
  /// In ar, this message translates to:
  /// **'أسرع موافقة'**
  String get q_opt_priority_fastest_approval;

  /// No description provided for @q_opt_priority_lowest_fees.
  ///
  /// In ar, this message translates to:
  /// **'أقل مصاريف إدارية'**
  String get q_opt_priority_lowest_fees;

  /// No description provided for @q_mortgage_q_assistance.
  ///
  /// In ar, this message translates to:
  /// **'هل تحتاج إلى مساعدة في تجهيز المستندات وإتمام الإجراءات؟'**
  String get q_mortgage_q_assistance;

  /// No description provided for @q_business_title.
  ///
  /// In ar, this message translates to:
  /// **'طلب تمويل تجاري'**
  String get q_business_title;

  /// No description provided for @q_business_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'سنطابقك مع البنوك المتخصصة في احتياجاتك'**
  String get q_business_subtitle;

  /// No description provided for @q_business_next.
  ///
  /// In ar, this message translates to:
  /// **'التالي'**
  String get q_business_next;

  /// No description provided for @q_business_finish.
  ///
  /// In ar, this message translates to:
  /// **'إنهاء'**
  String get q_business_finish;

  /// No description provided for @q_business_submitted.
  ///
  /// In ar, this message translates to:
  /// **'تم حفظ إجاباتك'**
  String get q_business_submitted;

  /// No description provided for @q_business_select_hint.
  ///
  /// In ar, this message translates to:
  /// **'اختر'**
  String get q_business_select_hint;

  /// No description provided for @q_business_years.
  ///
  /// In ar, this message translates to:
  /// **'{years} سنة'**
  String q_business_years(Object years);

  /// No description provided for @q_business_step1_title.
  ///
  /// In ar, this message translates to:
  /// **'بيانات النشاط والتمويل'**
  String get q_business_step1_title;

  /// No description provided for @q_business_step2_title.
  ///
  /// In ar, this message translates to:
  /// **'المعلومات المالية'**
  String get q_business_step2_title;

  /// No description provided for @q_business_step3_title.
  ///
  /// In ar, this message translates to:
  /// **'الالتزامات والوضع الائتماني'**
  String get q_business_step3_title;

  /// No description provided for @q_business_step4_title.
  ///
  /// In ar, this message translates to:
  /// **'التفضيلات والدعم'**
  String get q_business_step4_title;

  /// No description provided for @q_business_q_activity.
  ///
  /// In ar, this message translates to:
  /// **'ما نوع النشاط أو المشروع الذي تديره؟'**
  String get q_business_q_activity;

  /// No description provided for @q_business_hint_activity.
  ///
  /// In ar, this message translates to:
  /// **'اختر نوع النشاط'**
  String get q_business_hint_activity;

  /// No description provided for @q_opt_biz_activity_trade.
  ///
  /// In ar, this message translates to:
  /// **'تجارة'**
  String get q_opt_biz_activity_trade;

  /// No description provided for @q_opt_biz_activity_services.
  ///
  /// In ar, this message translates to:
  /// **'خدمات'**
  String get q_opt_biz_activity_services;

  /// No description provided for @q_opt_biz_activity_food.
  ///
  /// In ar, this message translates to:
  /// **'مطاعم ومقاهي'**
  String get q_opt_biz_activity_food;

  /// No description provided for @q_opt_biz_activity_manufacturing.
  ///
  /// In ar, this message translates to:
  /// **'تصنيع'**
  String get q_opt_biz_activity_manufacturing;

  /// No description provided for @q_opt_biz_activity_technology.
  ///
  /// In ar, this message translates to:
  /// **'تكنولوجيا'**
  String get q_opt_biz_activity_technology;

  /// No description provided for @q_opt_biz_activity_other.
  ///
  /// In ar, this message translates to:
  /// **'أخرى'**
  String get q_opt_biz_activity_other;

  /// No description provided for @q_business_q_business_age.
  ///
  /// In ar, this message translates to:
  /// **'منذ متى يعمل النشاط؟'**
  String get q_business_q_business_age;

  /// No description provided for @q_business_business_age_hint.
  ///
  /// In ar, this message translates to:
  /// **'عدد السنوات'**
  String get q_business_business_age_hint;

  /// No description provided for @q_business_q_financing_amount.
  ///
  /// In ar, this message translates to:
  /// **'ما قيمة التمويل التقريبية المطلوبة؟'**
  String get q_business_q_financing_amount;

  /// No description provided for @q_business_financing_amount_hint.
  ///
  /// In ar, this message translates to:
  /// **'قيمة التمويل المطلوبة'**
  String get q_business_financing_amount_hint;

  /// No description provided for @q_business_q_purpose.
  ///
  /// In ar, this message translates to:
  /// **'ما الغرض الأساسي من التمويل؟'**
  String get q_business_q_purpose;

  /// No description provided for @q_business_hint_purpose.
  ///
  /// In ar, this message translates to:
  /// **'اختر الغرض'**
  String get q_business_hint_purpose;

  /// No description provided for @q_opt_biz_purpose_expansion.
  ///
  /// In ar, this message translates to:
  /// **'توسعة'**
  String get q_opt_biz_purpose_expansion;

  /// No description provided for @q_opt_biz_purpose_equipment.
  ///
  /// In ar, this message translates to:
  /// **'شراء معدات'**
  String get q_opt_biz_purpose_equipment;

  /// No description provided for @q_opt_biz_purpose_working_capital.
  ///
  /// In ar, this message translates to:
  /// **'رأس مال تشغيلي'**
  String get q_opt_biz_purpose_working_capital;

  /// No description provided for @q_opt_biz_purpose_new_branch.
  ///
  /// In ar, this message translates to:
  /// **'افتتاح فرع جديد'**
  String get q_opt_biz_purpose_new_branch;

  /// No description provided for @q_opt_biz_purpose_settle_obligations.
  ///
  /// In ar, this message translates to:
  /// **'سداد التزامات'**
  String get q_opt_biz_purpose_settle_obligations;

  /// No description provided for @q_opt_biz_purpose_other.
  ///
  /// In ar, this message translates to:
  /// **'أخرى'**
  String get q_opt_biz_purpose_other;

  /// No description provided for @q_business_repayment_label.
  ///
  /// In ar, this message translates to:
  /// **'مدة السداد'**
  String get q_business_repayment_label;

  /// No description provided for @q_business_q_revenue.
  ///
  /// In ar, this message translates to:
  /// **'ما متوسط الإيراد الشهري للنشاط؟'**
  String get q_business_q_revenue;

  /// No description provided for @q_business_q_bank_account.
  ///
  /// In ar, this message translates to:
  /// **'هل لديك حساب بنكي للنشاط؟'**
  String get q_business_q_bank_account;

  /// No description provided for @q_business_q_registered.
  ///
  /// In ar, this message translates to:
  /// **'هل النشاط مسجل رسميًا؟'**
  String get q_business_q_registered;

  /// No description provided for @q_opt_biz_registration_in_progress.
  ///
  /// In ar, this message translates to:
  /// **'التسجيل قيد التنفيذ'**
  String get q_opt_biz_registration_in_progress;

  /// No description provided for @q_business_q_tax.
  ///
  /// In ar, this message translates to:
  /// **'هل لديك سجل ضريبي أو سجل تجاري؟'**
  String get q_business_q_tax;

  /// No description provided for @q_business_q_current_facilities.
  ///
  /// In ar, this message translates to:
  /// **'هل لدى النشاط حاليًا أي قروض أو تسهيلات تمويلية؟'**
  String get q_business_q_current_facilities;

  /// No description provided for @q_business_q_installments.
  ///
  /// In ar, this message translates to:
  /// **'ما إجمالي قيمة الالتزامات الشهرية الحالية؟'**
  String get q_business_q_installments;

  /// No description provided for @q_business_installments_label.
  ///
  /// In ar, this message translates to:
  /// **'الالتزامات الشهرية'**
  String get q_business_installments_label;

  /// No description provided for @q_business_installments_hint.
  ///
  /// In ar, this message translates to:
  /// **'قيمة القسط الشهري'**
  String get q_business_installments_hint;

  /// No description provided for @q_business_q_prior_rejection.
  ///
  /// In ar, this message translates to:
  /// **'هل سبق ورُفض للنشاط طلب تمويل؟'**
  String get q_business_q_prior_rejection;

  /// No description provided for @q_business_q_priority.
  ///
  /// In ar, this message translates to:
  /// **'ما الأهم بالنسبة لك في تمويل الأعمال؟'**
  String get q_business_q_priority;

  /// No description provided for @q_opt_biz_priority_fast_approval.
  ///
  /// In ar, this message translates to:
  /// **'أسرع موافقة'**
  String get q_opt_biz_priority_fast_approval;

  /// No description provided for @q_opt_biz_priority_flexible_repayment.
  ///
  /// In ar, this message translates to:
  /// **'سداد مرن'**
  String get q_opt_biz_priority_flexible_repayment;

  /// No description provided for @q_opt_biz_priority_highest_amount.
  ///
  /// In ar, this message translates to:
  /// **'أعلى مبلغ تمويل'**
  String get q_opt_biz_priority_highest_amount;

  /// No description provided for @q_opt_biz_priority_lowest_interest.
  ///
  /// In ar, this message translates to:
  /// **'أقل سعر فائدة'**
  String get q_opt_biz_priority_lowest_interest;

  /// No description provided for @q_opt_biz_priority_least_paperwork.
  ///
  /// In ar, this message translates to:
  /// **'أقل مستندات مطلوبة'**
  String get q_opt_biz_priority_least_paperwork;

  /// No description provided for @q_business_q_consultation.
  ///
  /// In ar, this message translates to:
  /// **'هل ترغب في استشارة خبير تمويل الأعمال؟'**
  String get q_business_q_consultation;

  /// No description provided for @q_car_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'سنطابقك مع البنوك المتخصصة في احتياجاتك'**
  String get q_car_subtitle;

  /// No description provided for @q_car_next.
  ///
  /// In ar, this message translates to:
  /// **'التالي'**
  String get q_car_next;

  /// No description provided for @q_car_finish.
  ///
  /// In ar, this message translates to:
  /// **'إنهاء'**
  String get q_car_finish;

  /// No description provided for @q_car_submitted.
  ///
  /// In ar, this message translates to:
  /// **'تم حفظ إجاباتك'**
  String get q_car_submitted;

  /// No description provided for @q_car_select_hint.
  ///
  /// In ar, this message translates to:
  /// **'اختر'**
  String get q_car_select_hint;

  /// No description provided for @q_car_years.
  ///
  /// In ar, this message translates to:
  /// **'{years} سنة'**
  String q_car_years(Object years);

  /// No description provided for @q_car_step1_title.
  ///
  /// In ar, this message translates to:
  /// **'معلومات السيارة والتمويل'**
  String get q_car_step1_title;

  /// No description provided for @q_car_step2_title.
  ///
  /// In ar, this message translates to:
  /// **'العمل والدخل'**
  String get q_car_step2_title;

  /// No description provided for @q_car_step3_title.
  ///
  /// In ar, this message translates to:
  /// **'الحالة المالية'**
  String get q_car_step3_title;

  /// No description provided for @q_car_step4_title.
  ///
  /// In ar, this message translates to:
  /// **'التفضيلات'**
  String get q_car_step4_title;

  /// No description provided for @q_car_q_condition.
  ///
  /// In ar, this message translates to:
  /// **'هل السيارة جديدة أم مستعملة؟'**
  String get q_car_q_condition;

  /// No description provided for @q_opt_car_cond_new.
  ///
  /// In ar, this message translates to:
  /// **'جديدة'**
  String get q_opt_car_cond_new;

  /// No description provided for @q_opt_car_cond_used.
  ///
  /// In ar, this message translates to:
  /// **'مستعملة'**
  String get q_opt_car_cond_used;

  /// No description provided for @q_car_q_model_year.
  ///
  /// In ar, this message translates to:
  /// **'ما سنة موديل السيارة؟'**
  String get q_car_q_model_year;

  /// No description provided for @q_opt_car_year_current.
  ///
  /// In ar, this message translates to:
  /// **'موديل السنة الحالية'**
  String get q_opt_car_year_current;

  /// No description provided for @q_opt_car_year_last3.
  ///
  /// In ar, this message translates to:
  /// **'خلال آخر 3 سنوات'**
  String get q_opt_car_year_last3;

  /// No description provided for @q_opt_car_year_3_5.
  ///
  /// In ar, this message translates to:
  /// **'من 3 إلى 5 سنوات'**
  String get q_opt_car_year_3_5;

  /// No description provided for @q_opt_car_year_over5.
  ///
  /// In ar, this message translates to:
  /// **'أكثر من 5 سنوات'**
  String get q_opt_car_year_over5;

  /// No description provided for @q_car_q_price.
  ///
  /// In ar, this message translates to:
  /// **'ما السعر التقريبي للسيارة؟'**
  String get q_car_q_price;

  /// No description provided for @q_car_q_down_payment.
  ///
  /// In ar, this message translates to:
  /// **'ما حجم الدفعة المقدمة المتاحة لديك؟'**
  String get q_car_q_down_payment;

  /// No description provided for @q_opt_car_dp_none.
  ///
  /// In ar, this message translates to:
  /// **'بدون دفعة مقدمة'**
  String get q_opt_car_dp_none;

  /// No description provided for @q_opt_car_dp_under20.
  ///
  /// In ar, this message translates to:
  /// **'أقل من 20%'**
  String get q_opt_car_dp_under20;

  /// No description provided for @q_opt_car_dp_20_40.
  ///
  /// In ar, this message translates to:
  /// **'20% – 40%'**
  String get q_opt_car_dp_20_40;

  /// No description provided for @q_opt_car_dp_over40.
  ///
  /// In ar, this message translates to:
  /// **'أكثر من 40%'**
  String get q_opt_car_dp_over40;

  /// No description provided for @q_car_repayment_label.
  ///
  /// In ar, this message translates to:
  /// **'مدة السداد'**
  String get q_car_repayment_label;

  /// No description provided for @q_car_q_employment.
  ///
  /// In ar, this message translates to:
  /// **'ما هي حالتك الوظيفية؟'**
  String get q_car_q_employment;

  /// No description provided for @q_car_q_income.
  ///
  /// In ar, this message translates to:
  /// **'ما متوسط دخلك الشهري؟'**
  String get q_car_q_income;

  /// No description provided for @q_opt_car_income_b1.
  ///
  /// In ar, this message translates to:
  /// **'أقل من 10,000 جنيه'**
  String get q_opt_car_income_b1;

  /// No description provided for @q_opt_car_income_b2.
  ///
  /// In ar, this message translates to:
  /// **'10,000 – 25,000 جنيه'**
  String get q_opt_car_income_b2;

  /// No description provided for @q_opt_car_income_b3.
  ///
  /// In ar, this message translates to:
  /// **'25,000 – 50,000 جنيه'**
  String get q_opt_car_income_b3;

  /// No description provided for @q_opt_car_income_b4.
  ///
  /// In ar, this message translates to:
  /// **'أكثر من 50,000 جنيه'**
  String get q_opt_car_income_b4;

  /// No description provided for @q_car_q_salary_transfer.
  ///
  /// In ar, this message translates to:
  /// **'هل يتم تحويل راتبك إلى حساب بنكي؟'**
  String get q_car_q_salary_transfer;

  /// No description provided for @q_car_q_employer_approved.
  ///
  /// In ar, this message translates to:
  /// **'هل جهة عملك معتمدة لدى البنوك؟'**
  String get q_car_q_employer_approved;

  /// No description provided for @q_opt_car_emp_yes.
  ///
  /// In ar, this message translates to:
  /// **'نعم'**
  String get q_opt_car_emp_yes;

  /// No description provided for @q_opt_car_emp_no.
  ///
  /// In ar, this message translates to:
  /// **'لا'**
  String get q_opt_car_emp_no;

  /// No description provided for @q_opt_car_emp_unsure.
  ///
  /// In ar, this message translates to:
  /// **'غير متأكد'**
  String get q_opt_car_emp_unsure;

  /// No description provided for @q_car_q_current_loans.
  ///
  /// In ar, this message translates to:
  /// **'هل لديك التزامات أو قروض حالية؟'**
  String get q_car_q_current_loans;

  /// No description provided for @q_car_installments_label.
  ///
  /// In ar, this message translates to:
  /// **'القسط الشهري'**
  String get q_car_installments_label;

  /// No description provided for @q_car_installments_hint.
  ///
  /// In ar, this message translates to:
  /// **'قيمة القسط الشهري'**
  String get q_car_installments_hint;

  /// No description provided for @q_car_q_credit_card.
  ///
  /// In ar, this message translates to:
  /// **'هل لديك بطاقات ائتمان نشطة؟'**
  String get q_car_q_credit_card;

  /// No description provided for @q_car_q_priority.
  ///
  /// In ar, this message translates to:
  /// **'أهم أولوية عند اختيار تمويل السيارة؟'**
  String get q_car_q_priority;

  /// No description provided for @q_opt_priority_lowest_interest.
  ///
  /// In ar, this message translates to:
  /// **'أقل سعر فائدة'**
  String get q_opt_priority_lowest_interest;

  /// No description provided for @q_opt_priority_no_guarantor.
  ///
  /// In ar, this message translates to:
  /// **'تمويل بدون ضامن'**
  String get q_opt_priority_no_guarantor;

  /// No description provided for @q_car_q_insurance.
  ///
  /// In ar, this message translates to:
  /// **'هل ترغب في عروض تأمين السيارة؟'**
  String get q_car_q_insurance;

  /// No description provided for @q_personal_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'سنطابقك مع البنوك المتخصصة في احتياجاتك'**
  String get q_personal_subtitle;

  /// No description provided for @q_personal_next.
  ///
  /// In ar, this message translates to:
  /// **'التالي'**
  String get q_personal_next;

  /// No description provided for @q_personal_finish.
  ///
  /// In ar, this message translates to:
  /// **'إنهاء'**
  String get q_personal_finish;

  /// No description provided for @q_personal_submitted.
  ///
  /// In ar, this message translates to:
  /// **'تم حفظ إجاباتك'**
  String get q_personal_submitted;

  /// No description provided for @q_personal_select_hint.
  ///
  /// In ar, this message translates to:
  /// **'اختر'**
  String get q_personal_select_hint;

  /// No description provided for @q_dyn_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'سنطابقك مع البنوك المتخصصة في احتياجاتك'**
  String get q_dyn_subtitle;

  /// No description provided for @q_dyn_select_hint.
  ///
  /// In ar, this message translates to:
  /// **'اختر'**
  String get q_dyn_select_hint;

  /// No description provided for @q_dyn_next.
  ///
  /// In ar, this message translates to:
  /// **'التالي'**
  String get q_dyn_next;

  /// No description provided for @q_dyn_finish.
  ///
  /// In ar, this message translates to:
  /// **'إنهاء'**
  String get q_dyn_finish;

  /// No description provided for @q_dyn_error_title.
  ///
  /// In ar, this message translates to:
  /// **'حدث خطأ ما'**
  String get q_dyn_error_title;

  /// No description provided for @q_dyn_error_message.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تحميل الاستبيان. يرجى المحاولة مرة أخرى.'**
  String get q_dyn_error_message;

  /// No description provided for @q_dyn_retry.
  ///
  /// In ar, this message translates to:
  /// **'إعادة المحاولة'**
  String get q_dyn_retry;

  /// No description provided for @q_dyn_empty.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد أسئلة متاحة حالياً.'**
  String get q_dyn_empty;

  /// No description provided for @q_dyn_select_many_hint.
  ///
  /// In ar, this message translates to:
  /// **'اختر واحداً أو أكثر'**
  String get q_dyn_select_many_hint;

  /// No description provided for @q_dyn_text_hint.
  ///
  /// In ar, this message translates to:
  /// **'اكتب إجابتك'**
  String get q_dyn_text_hint;

  /// No description provided for @q_dyn_number_hint.
  ///
  /// In ar, this message translates to:
  /// **'أدخل رقماً'**
  String get q_dyn_number_hint;

  /// No description provided for @q_dyn_number_invalid.
  ///
  /// In ar, this message translates to:
  /// **'أدخل رقماً صحيحاً.'**
  String get q_dyn_number_invalid;

  /// No description provided for @q_dyn_number_range.
  ///
  /// In ar, this message translates to:
  /// **'أدخل قيمة بين {min} و {max}.'**
  String q_dyn_number_range(String min, String max);

  /// No description provided for @q_dyn_number_min.
  ///
  /// In ar, this message translates to:
  /// **'أدخل {min} أو أكثر.'**
  String q_dyn_number_min(String min);

  /// No description provided for @q_dyn_number_max.
  ///
  /// In ar, this message translates to:
  /// **'أدخل {max} أو أقل.'**
  String q_dyn_number_max(String max);

  /// No description provided for @q_dyn_number_step.
  ///
  /// In ar, this message translates to:
  /// **'أدخل قيمة بمضاعفات {step}.'**
  String q_dyn_number_step(String step);

  /// No description provided for @q_dyn_number_step_nearest.
  ///
  /// In ar, this message translates to:
  /// **'القيم تتزايد بمقدار {step} — أقرب قيمة صحيحة {lower} أو {upper}.'**
  String q_dyn_number_step_nearest(String step, String lower, String upper);

  /// No description provided for @q_dyn_number_step_nearest_one.
  ///
  /// In ar, this message translates to:
  /// **'القيم تتزايد بمقدار {step} — أقرب قيمة صحيحة {value}.'**
  String q_dyn_number_step_nearest_one(String step, String value);

  /// No description provided for @q_dyn_number_step_helper.
  ///
  /// In ar, this message translates to:
  /// **'بمضاعفات {step}'**
  String q_dyn_number_step_helper(String step);

  /// Helper under the read-only derived obligations total
  ///
  /// In ar, this message translates to:
  /// **'محسوب من الأقساط التي أدخلتها أعلاه.'**
  String get q_dyn_obligations_total_helper;

  /// No description provided for @q_dyn_money_missing.
  ///
  /// In ar, this message translates to:
  /// **'أدخل المبلغ ومدة السداد والدخل والأقساط الحالية لعرض العروض المتاحة.'**
  String get q_dyn_money_missing;

  /// No description provided for @q_personal_years.
  ///
  /// In ar, this message translates to:
  /// **'{years} سنة'**
  String q_personal_years(Object years);

  /// No description provided for @q_personal_step1_title.
  ///
  /// In ar, this message translates to:
  /// **'بيانات التمويل'**
  String get q_personal_step1_title;

  /// No description provided for @q_personal_step2_title.
  ///
  /// In ar, this message translates to:
  /// **'العمل والدخل'**
  String get q_personal_step2_title;

  /// No description provided for @q_personal_step3_title.
  ///
  /// In ar, this message translates to:
  /// **'الالتزامات البنكية'**
  String get q_personal_step3_title;

  /// No description provided for @q_personal_step4_title.
  ///
  /// In ar, this message translates to:
  /// **'التفضيلات والمؤهلات'**
  String get q_personal_step4_title;

  /// No description provided for @q_personal_q_amount.
  ///
  /// In ar, this message translates to:
  /// **'ما المبلغ التقريبي الذي تحتاجه؟'**
  String get q_personal_q_amount;

  /// No description provided for @q_personal_amount_label.
  ///
  /// In ar, this message translates to:
  /// **'قيمة القرض'**
  String get q_personal_amount_label;

  /// No description provided for @q_personal_amount_hint.
  ///
  /// In ar, this message translates to:
  /// **'المبلغ التقريبي الذي تحتاجه'**
  String get q_personal_amount_hint;

  /// No description provided for @q_personal_q_repayment.
  ///
  /// In ar, this message translates to:
  /// **'ما مدة السداد المناسبة لك؟'**
  String get q_personal_q_repayment;

  /// No description provided for @q_personal_repayment_label.
  ///
  /// In ar, this message translates to:
  /// **'مدة السداد'**
  String get q_personal_repayment_label;

  /// No description provided for @q_personal_q_purpose.
  ///
  /// In ar, this message translates to:
  /// **'ما الغرض من القرض؟'**
  String get q_personal_q_purpose;

  /// No description provided for @q_personal_hint_purpose.
  ///
  /// In ar, this message translates to:
  /// **'الغرض من القرض'**
  String get q_personal_hint_purpose;

  /// No description provided for @q_opt_personal_purpose_home_finishing.
  ///
  /// In ar, this message translates to:
  /// **'تشطيب / تجديد المنزل'**
  String get q_opt_personal_purpose_home_finishing;

  /// No description provided for @q_opt_personal_purpose_marriage.
  ///
  /// In ar, this message translates to:
  /// **'زواج'**
  String get q_opt_personal_purpose_marriage;

  /// No description provided for @q_opt_personal_purpose_appliances.
  ///
  /// In ar, this message translates to:
  /// **'شراء أجهزة أو أثاث'**
  String get q_opt_personal_purpose_appliances;

  /// No description provided for @q_opt_personal_purpose_education.
  ///
  /// In ar, this message translates to:
  /// **'تعليم'**
  String get q_opt_personal_purpose_education;

  /// No description provided for @q_opt_personal_purpose_debt_consolidation.
  ///
  /// In ar, this message translates to:
  /// **'سداد ديون'**
  String get q_opt_personal_purpose_debt_consolidation;

  /// No description provided for @q_opt_personal_purpose_personal_project.
  ///
  /// In ar, this message translates to:
  /// **'مشروع شخصي'**
  String get q_opt_personal_purpose_personal_project;

  /// No description provided for @q_opt_personal_purpose_other.
  ///
  /// In ar, this message translates to:
  /// **'أخرى'**
  String get q_opt_personal_purpose_other;

  /// No description provided for @q_personal_q_employment.
  ///
  /// In ar, this message translates to:
  /// **'ما هي حالتك الوظيفية؟'**
  String get q_personal_q_employment;

  /// No description provided for @q_personal_q_job_tenure.
  ///
  /// In ar, this message translates to:
  /// **'منذ متى وأنت في وظيفتك الحالية؟'**
  String get q_personal_q_job_tenure;

  /// No description provided for @q_personal_hint_job_tenure.
  ///
  /// In ar, this message translates to:
  /// **'الوظيفة الحالية'**
  String get q_personal_hint_job_tenure;

  /// No description provided for @q_opt_personal_tenure_under6m.
  ///
  /// In ar, this message translates to:
  /// **'أقل من 6 أشهر'**
  String get q_opt_personal_tenure_under6m;

  /// No description provided for @q_opt_personal_tenure_6m_1y.
  ///
  /// In ar, this message translates to:
  /// **'6 أشهر – سنة'**
  String get q_opt_personal_tenure_6m_1y;

  /// No description provided for @q_opt_personal_tenure_1_3y.
  ///
  /// In ar, this message translates to:
  /// **'1 – 3 سنوات'**
  String get q_opt_personal_tenure_1_3y;

  /// No description provided for @q_opt_personal_tenure_over3y.
  ///
  /// In ar, this message translates to:
  /// **'أكثر من 3 سنوات'**
  String get q_opt_personal_tenure_over3y;

  /// No description provided for @q_personal_q_income.
  ///
  /// In ar, this message translates to:
  /// **'ما متوسط دخلك الشهري؟'**
  String get q_personal_q_income;

  /// No description provided for @q_opt_personal_income_b1.
  ///
  /// In ar, this message translates to:
  /// **'بدءًا من 10,000 جنيه'**
  String get q_opt_personal_income_b1;

  /// No description provided for @q_opt_personal_income_b2.
  ///
  /// In ar, this message translates to:
  /// **'10,000 – 20,000 جنيه'**
  String get q_opt_personal_income_b2;

  /// No description provided for @q_opt_personal_income_b3.
  ///
  /// In ar, this message translates to:
  /// **'20,000 – 50,000 جنيه'**
  String get q_opt_personal_income_b3;

  /// No description provided for @q_opt_personal_income_b4.
  ///
  /// In ar, this message translates to:
  /// **'50,000 – 80,000 جنيه'**
  String get q_opt_personal_income_b4;

  /// No description provided for @q_opt_personal_income_b5.
  ///
  /// In ar, this message translates to:
  /// **'أكثر من 100,000 جنيه'**
  String get q_opt_personal_income_b5;

  /// No description provided for @q_personal_q_salary_transfer.
  ///
  /// In ar, this message translates to:
  /// **'هل يتم تحويل راتبك إلى حساب بنكي؟'**
  String get q_personal_q_salary_transfer;

  /// No description provided for @q_personal_q_employer_approved.
  ///
  /// In ar, this message translates to:
  /// **'هل جهة عملك معتمدة لدى البنوك؟'**
  String get q_personal_q_employer_approved;

  /// No description provided for @q_opt_personal_emp_yes.
  ///
  /// In ar, this message translates to:
  /// **'نعم'**
  String get q_opt_personal_emp_yes;

  /// No description provided for @q_opt_personal_emp_no.
  ///
  /// In ar, this message translates to:
  /// **'لا'**
  String get q_opt_personal_emp_no;

  /// No description provided for @q_opt_personal_emp_unsure.
  ///
  /// In ar, this message translates to:
  /// **'غير متأكد'**
  String get q_opt_personal_emp_unsure;

  /// No description provided for @q_personal_q_obligations.
  ///
  /// In ar, this message translates to:
  /// **'هل لديك حاليًا أي قروض أو التزامات مالية؟'**
  String get q_personal_q_obligations;

  /// No description provided for @q_personal_hint_obligations.
  ///
  /// In ar, this message translates to:
  /// **'قروض أو التزامات مالية'**
  String get q_personal_hint_obligations;

  /// No description provided for @q_opt_personal_obligation_none.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد'**
  String get q_opt_personal_obligation_none;

  /// No description provided for @q_opt_personal_obligation_personal_loan.
  ///
  /// In ar, this message translates to:
  /// **'قرض شخصي'**
  String get q_opt_personal_obligation_personal_loan;

  /// No description provided for @q_opt_personal_obligation_car_loan.
  ///
  /// In ar, this message translates to:
  /// **'قرض سيارة'**
  String get q_opt_personal_obligation_car_loan;

  /// No description provided for @q_opt_personal_obligation_mortgage.
  ///
  /// In ar, this message translates to:
  /// **'تمويل عقاري'**
  String get q_opt_personal_obligation_mortgage;

  /// No description provided for @q_opt_personal_obligation_credit_cards.
  ///
  /// In ar, this message translates to:
  /// **'بطاقات ائتمان'**
  String get q_opt_personal_obligation_credit_cards;

  /// No description provided for @q_opt_personal_obligation_other.
  ///
  /// In ar, this message translates to:
  /// **'أخرى'**
  String get q_opt_personal_obligation_other;

  /// No description provided for @q_personal_q_installment.
  ///
  /// In ar, this message translates to:
  /// **'ما إجمالي قيمة قسطك الشهري التقريبي؟'**
  String get q_personal_q_installment;

  /// No description provided for @q_personal_installment_label.
  ///
  /// In ar, this message translates to:
  /// **'القسط الشهري'**
  String get q_personal_installment_label;

  /// No description provided for @q_personal_installment_hint.
  ///
  /// In ar, this message translates to:
  /// **'القسط الشهري'**
  String get q_personal_installment_hint;

  /// No description provided for @q_personal_q_credit_card.
  ///
  /// In ar, this message translates to:
  /// **'هل لديك بطاقة ائتمان؟'**
  String get q_personal_q_credit_card;

  /// No description provided for @q_personal_q_credit_card_usage.
  ///
  /// In ar, this message translates to:
  /// **'إذا نعم، ما متوسط استخدامك الشهري لبطاقة الائتمان؟'**
  String get q_personal_q_credit_card_usage;

  /// No description provided for @q_opt_personal_cc_usage_b1.
  ///
  /// In ar, this message translates to:
  /// **'أقل من 10,000 جنيه'**
  String get q_opt_personal_cc_usage_b1;

  /// No description provided for @q_opt_personal_cc_usage_b2.
  ///
  /// In ar, this message translates to:
  /// **'10,000 – 30,000 جنيه'**
  String get q_opt_personal_cc_usage_b2;

  /// No description provided for @q_opt_personal_cc_usage_b3.
  ///
  /// In ar, this message translates to:
  /// **'30,000 – 50,000 جنيه'**
  String get q_opt_personal_cc_usage_b3;

  /// No description provided for @q_opt_personal_cc_usage_b4.
  ///
  /// In ar, this message translates to:
  /// **'أكثر من 50,000 جنيه'**
  String get q_opt_personal_cc_usage_b4;

  /// No description provided for @q_personal_q_priority.
  ///
  /// In ar, this message translates to:
  /// **'ما العامل الأهم عند اختيار التمويل؟'**
  String get q_personal_q_priority;

  /// No description provided for @q_opt_personal_priority_lowest_installment.
  ///
  /// In ar, this message translates to:
  /// **'أقل قسط شهري'**
  String get q_opt_personal_priority_lowest_installment;

  /// No description provided for @q_opt_personal_priority_lowest_interest.
  ///
  /// In ar, this message translates to:
  /// **'أقل سعر فائدة'**
  String get q_opt_personal_priority_lowest_interest;

  /// No description provided for @q_opt_personal_priority_minimum_docs.
  ///
  /// In ar, this message translates to:
  /// **'أقل مستندات مطلوبة'**
  String get q_opt_personal_priority_minimum_docs;

  /// No description provided for @q_opt_personal_priority_flexible_repayment.
  ///
  /// In ar, this message translates to:
  /// **'سداد مرن'**
  String get q_opt_personal_priority_flexible_repayment;

  /// No description provided for @q_personal_q_prior_rejection.
  ///
  /// In ar, this message translates to:
  /// **'هل سبق ورُفض لك طلب تمويل؟'**
  String get q_personal_q_prior_rejection;

  /// No description provided for @q_personal_q_assistance.
  ///
  /// In ar, this message translates to:
  /// **'هل تحتاج إلى مساعدة في تجهيز المستندات وإتمام الإجراءات؟'**
  String get q_personal_q_assistance;

  /// No description provided for @profile_title.
  ///
  /// In ar, this message translates to:
  /// **'الملف الشخصي'**
  String get profile_title;

  /// No description provided for @profile_section_personal.
  ///
  /// In ar, this message translates to:
  /// **'المعلومات الشخصية'**
  String get profile_section_personal;

  /// No description provided for @profile_section_contact.
  ///
  /// In ar, this message translates to:
  /// **'بيانات التواصل'**
  String get profile_section_contact;

  /// No description provided for @profile_edit.
  ///
  /// In ar, this message translates to:
  /// **'تعديل'**
  String get profile_edit;

  /// No description provided for @profile_first_name.
  ///
  /// In ar, this message translates to:
  /// **'الاسم الأول'**
  String get profile_first_name;

  /// No description provided for @profile_last_name.
  ///
  /// In ar, this message translates to:
  /// **'اسم العائلة'**
  String get profile_last_name;

  /// No description provided for @profile_password.
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور'**
  String get profile_password;

  /// No description provided for @profile_password_changed.
  ///
  /// In ar, this message translates to:
  /// **'آخر تغيير منذ {count} أشهر'**
  String profile_password_changed(int count);

  /// No description provided for @profile_password_hint.
  ///
  /// In ar, this message translates to:
  /// **'كلمة مرور جديدة'**
  String get profile_password_hint;

  /// No description provided for @profile_dob.
  ///
  /// In ar, this message translates to:
  /// **'تاريخ الميلاد'**
  String get profile_dob;

  /// No description provided for @profile_dob_day.
  ///
  /// In ar, this message translates to:
  /// **'اليوم'**
  String get profile_dob_day;

  /// No description provided for @profile_dob_month.
  ///
  /// In ar, this message translates to:
  /// **'الشهر'**
  String get profile_dob_month;

  /// No description provided for @profile_dob_year.
  ///
  /// In ar, this message translates to:
  /// **'السنة'**
  String get profile_dob_year;

  /// No description provided for @profile_dob_hint.
  ///
  /// In ar, this message translates to:
  /// **'اختر تاريخ الميلاد'**
  String get profile_dob_hint;

  /// No description provided for @profile_national_id.
  ///
  /// In ar, this message translates to:
  /// **'الرقم القومي'**
  String get profile_national_id;

  /// No description provided for @profile_national_id_hint.
  ///
  /// In ar, this message translates to:
  /// **'— مطلوب لأهلية القرض'**
  String get profile_national_id_hint;

  /// No description provided for @profile_id_front.
  ///
  /// In ar, this message translates to:
  /// **'الوجه الأمامي'**
  String get profile_id_front;

  /// No description provided for @profile_id_back.
  ///
  /// In ar, this message translates to:
  /// **'الوجه الخلفي'**
  String get profile_id_back;

  /// No description provided for @profile_id_uploaded.
  ///
  /// In ar, this message translates to:
  /// **'تم الرفع'**
  String get profile_id_uploaded;

  /// No description provided for @profile_id_tap_to_upload.
  ///
  /// In ar, this message translates to:
  /// **'اضغط للرفع'**
  String get profile_id_tap_to_upload;

  /// No description provided for @profile_id_uploading.
  ///
  /// In ar, this message translates to:
  /// **'جارٍ الرفع…'**
  String get profile_id_uploading;

  /// No description provided for @profile_id_upload_failed.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر رفع البطاقة. حاول مرة أخرى.'**
  String get profile_id_upload_failed;

  /// No description provided for @profile_save_failed.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر حفظ الملف الشخصي. حاول مرة أخرى.'**
  String get profile_save_failed;

  /// No description provided for @profile_save_success.
  ///
  /// In ar, this message translates to:
  /// **'تم تحديث ملفك الشخصي.'**
  String get profile_save_success;

  /// No description provided for @profile_email_taken.
  ///
  /// In ar, this message translates to:
  /// **'هذا البريد الإلكتروني مستخدم بالفعل في حساب آخر.'**
  String get profile_email_taken;

  /// No description provided for @profile_dob_locked.
  ///
  /// In ar, this message translates to:
  /// **'لا يمكن تغيير تاريخ الميلاد بعد ضبطه.'**
  String get profile_dob_locked;

  /// No description provided for @profile_phone_readonly.
  ///
  /// In ar, this message translates to:
  /// **'لا يمكن تغيير رقم هاتفك.'**
  String get profile_phone_readonly;

  /// No description provided for @profile_phone.
  ///
  /// In ar, this message translates to:
  /// **'الهاتف'**
  String get profile_phone;

  /// No description provided for @profile_phone_hint.
  ///
  /// In ar, this message translates to:
  /// **'رقم الهاتف'**
  String get profile_phone_hint;

  /// No description provided for @profile_email.
  ///
  /// In ar, this message translates to:
  /// **'البريد الإلكتروني'**
  String get profile_email;

  /// No description provided for @profile_address.
  ///
  /// In ar, this message translates to:
  /// **'العنوان'**
  String get profile_address;

  /// No description provided for @profile_governorate.
  ///
  /// In ar, this message translates to:
  /// **'المحافظة'**
  String get profile_governorate;

  /// No description provided for @profile_city.
  ///
  /// In ar, this message translates to:
  /// **'المدينة'**
  String get profile_city;

  /// No description provided for @profile_save.
  ///
  /// In ar, this message translates to:
  /// **'حفظ'**
  String get profile_save;

  /// No description provided for @profile_cancel.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء'**
  String get profile_cancel;

  /// No description provided for @profile_search_hint.
  ///
  /// In ar, this message translates to:
  /// **'بحث'**
  String get profile_search_hint;

  /// No description provided for @results_title.
  ///
  /// In ar, this message translates to:
  /// **'أفضل العروض المطابقة جاهزة'**
  String get results_title;

  /// No description provided for @results_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'مستشار القروض جاهز'**
  String get results_subtitle;

  /// No description provided for @results_empty_title.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد عروض بعد'**
  String get results_empty_title;

  /// No description provided for @results_empty_body.
  ///
  /// In ar, this message translates to:
  /// **'لم نتمكن من العثور على برامج مطابقة لإجاباتك الآن.'**
  String get results_empty_body;

  /// No description provided for @results_profile_title.
  ///
  /// In ar, this message translates to:
  /// **'أكمل ملفك الشخصي'**
  String get results_profile_title;

  /// No description provided for @results_profile_body.
  ///
  /// In ar, this message translates to:
  /// **'أكمل ملفك الشخصي لعرض عروض القروض.'**
  String get results_profile_body;

  /// No description provided for @results_profile_action.
  ///
  /// In ar, this message translates to:
  /// **'إكمال الملف الشخصي'**
  String get results_profile_action;

  /// No description provided for @results_loan_type.
  ///
  /// In ar, this message translates to:
  /// **'نوع القرض'**
  String get results_loan_type;

  /// No description provided for @results_amount.
  ///
  /// In ar, this message translates to:
  /// **'المبلغ'**
  String get results_amount;

  /// No description provided for @results_requested.
  ///
  /// In ar, this message translates to:
  /// **'المبلغ المطلوب'**
  String get results_requested;

  /// No description provided for @results_requested_duration.
  ///
  /// In ar, this message translates to:
  /// **'المدة المطلوبة'**
  String get results_requested_duration;

  /// No description provided for @results_approved_amount.
  ///
  /// In ar, this message translates to:
  /// **'المبلغ المعتمد'**
  String get results_approved_amount;

  /// No description provided for @results_amount_egp.
  ///
  /// In ar, this message translates to:
  /// **'{amount} ج.م'**
  String results_amount_egp(String amount);

  /// No description provided for @results_duration.
  ///
  /// In ar, this message translates to:
  /// **'مدة القرض'**
  String get results_duration;

  /// No description provided for @results_months.
  ///
  /// In ar, this message translates to:
  /// **'{count} شهرًا'**
  String results_months(int count);

  /// No description provided for @results_guarantee_approval.
  ///
  /// In ar, this message translates to:
  /// **'توافق {pct}%'**
  String results_guarantee_approval(int pct);

  /// No description provided for @results_unrated.
  ///
  /// In ar, this message translates to:
  /// **'لم يُقيَّم بعد'**
  String get results_unrated;

  /// Heading above the checked-but-not-quotable programs
  ///
  /// In ar, this message translates to:
  /// **'غير متاح لك حاليًا'**
  String get results_unavailable_section;

  /// Badge on an unavailable program card
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد عرض من هذا البنك'**
  String get results_unavailable_badge;

  /// Fallback for an unrecognised figures-unavailable reason code
  ///
  /// In ar, this message translates to:
  /// **'تعذّر على هذا البنك تقديم عرض لك حاليًا.'**
  String get results_unavailable_generic;

  /// The applicant's ceiling at an unavailable program
  ///
  /// In ar, this message translates to:
  /// **'يمكنك الاقتراض حتى {amount} جنيه من هذا البنك.'**
  String results_unavailable_ceiling(String amount);

  /// No description provided for @results_best_match.
  ///
  /// In ar, this message translates to:
  /// **'أفضل تطابق'**
  String get results_best_match;

  /// No description provided for @results_rate.
  ///
  /// In ar, this message translates to:
  /// **'الفائدة'**
  String get results_rate;

  /// No description provided for @results_monthly.
  ///
  /// In ar, this message translates to:
  /// **'شهريًا'**
  String get results_monthly;

  /// No description provided for @results_total.
  ///
  /// In ar, this message translates to:
  /// **'الإجمالي'**
  String get results_total;

  /// No description provided for @results_view_offer.
  ///
  /// In ar, this message translates to:
  /// **'عرض العرض'**
  String get results_view_offer;

  /// No description provided for @results_max_borrow.
  ///
  /// In ar, this message translates to:
  /// **'تقدر تقترض حتى'**
  String get results_max_borrow;

  /// No description provided for @results_max_borrow_value.
  ///
  /// In ar, this message translates to:
  /// **'{amount} جنيه'**
  String results_max_borrow_value(String amount);

  /// No description provided for @offer_type_personal.
  ///
  /// In ar, this message translates to:
  /// **'شخصي'**
  String get offer_type_personal;

  /// No description provided for @offer_type_car.
  ///
  /// In ar, this message translates to:
  /// **'سيارة'**
  String get offer_type_car;

  /// No description provided for @offer_type_mortgage.
  ///
  /// In ar, this message translates to:
  /// **'عقاري'**
  String get offer_type_mortgage;

  /// No description provided for @offer_type_business.
  ///
  /// In ar, this message translates to:
  /// **'أعمال'**
  String get offer_type_business;

  /// No description provided for @offer_title.
  ///
  /// In ar, this message translates to:
  /// **'قرض {type}'**
  String offer_title(String type);

  /// No description provided for @offer_approval.
  ///
  /// In ar, this message translates to:
  /// **'درجة التوافق {pct}%'**
  String offer_approval(int pct);

  /// No description provided for @offer_unrated.
  ///
  /// In ar, this message translates to:
  /// **'لم يُقيَّم بعد'**
  String get offer_unrated;

  /// No description provided for @offer_interest_rate.
  ///
  /// In ar, this message translates to:
  /// **'سعر الفائدة'**
  String get offer_interest_rate;

  /// No description provided for @offer_fixed_apr.
  ///
  /// In ar, this message translates to:
  /// **'فائدة ثابتة'**
  String get offer_fixed_apr;

  /// No description provided for @offer_monthly.
  ///
  /// In ar, this message translates to:
  /// **'شهريًا'**
  String get offer_monthly;

  /// No description provided for @offer_egp_month.
  ///
  /// In ar, this message translates to:
  /// **'ج.م / شهر'**
  String get offer_egp_month;

  /// No description provided for @offer_duration.
  ///
  /// In ar, this message translates to:
  /// **'المدة'**
  String get offer_duration;

  /// No description provided for @offer_months.
  ///
  /// In ar, this message translates to:
  /// **'أشهر'**
  String get offer_months;

  /// No description provided for @offer_total_interest.
  ///
  /// In ar, this message translates to:
  /// **'إجمالي الفائدة'**
  String get offer_total_interest;

  /// No description provided for @offer_total_interest_caption.
  ///
  /// In ar, this message translates to:
  /// **'فائدة على مدة القرض'**
  String get offer_total_interest_caption;

  /// No description provided for @offer_cash_received.
  ///
  /// In ar, this message translates to:
  /// **'المبلغ اللي هتستلمه'**
  String get offer_cash_received;

  /// No description provided for @offer_cash_received_caption.
  ///
  /// In ar, this message translates to:
  /// **'بعد خصم الرسوم'**
  String get offer_cash_received_caption;

  /// No description provided for @offer_egp_extra.
  ///
  /// In ar, this message translates to:
  /// **'ج.م إضافية'**
  String get offer_egp_extra;

  /// No description provided for @offer_national_id.
  ///
  /// In ar, this message translates to:
  /// **'الرقم القومي'**
  String get offer_national_id;

  /// No description provided for @offer_national_id_pending.
  ///
  /// In ar, this message translates to:
  /// **'قيد الانتظار'**
  String get offer_national_id_pending;

  /// No description provided for @offer_personal_id.
  ///
  /// In ar, this message translates to:
  /// **'إثبات الهوية'**
  String get offer_personal_id;

  /// No description provided for @offer_total_loan.
  ///
  /// In ar, this message translates to:
  /// **'إجمالي القرض'**
  String get offer_total_loan;

  /// No description provided for @offer_total_loan_caption.
  ///
  /// In ar, this message translates to:
  /// **'شامل الفائدة + الأصل'**
  String get offer_total_loan_caption;

  /// No description provided for @offer_max_borrow.
  ///
  /// In ar, this message translates to:
  /// **'أقصى مبلغ تقدر تقترضه'**
  String get offer_max_borrow;

  /// No description provided for @offer_max_borrow_caption.
  ///
  /// In ar, this message translates to:
  /// **'بحد أقصى {pct}% لنسبة الالتزامات'**
  String offer_max_borrow_caption(String pct);

  /// No description provided for @offer_dbr.
  ///
  /// In ar, this message translates to:
  /// **'نسبة الالتزامات'**
  String get offer_dbr;

  /// No description provided for @offer_dbr_caption.
  ///
  /// In ar, this message translates to:
  /// **'من دخلك الشهري'**
  String get offer_dbr_caption;

  /// No description provided for @offer_headroom_hint.
  ///
  /// In ar, this message translates to:
  /// **'طلبت أقل من المبلغ اللي تقدر تاخده.'**
  String get offer_headroom_hint;

  /// No description provided for @offer_fees_title.
  ///
  /// In ar, this message translates to:
  /// **'الرسوم والمصاريف'**
  String get offer_fees_title;

  /// No description provided for @offer_admin_fees.
  ///
  /// In ar, this message translates to:
  /// **'رسوم إدارية'**
  String get offer_admin_fees;

  /// No description provided for @offer_admin_fees_value.
  ///
  /// In ar, this message translates to:
  /// **'1% (1,500 ج.م)'**
  String get offer_admin_fees_value;

  /// No description provided for @offer_interest_charge.
  ///
  /// In ar, this message translates to:
  /// **'12% - 15% من أصل المبلغ'**
  String get offer_interest_charge;

  /// No description provided for @offer_interest_charge_value.
  ///
  /// In ar, this message translates to:
  /// **'12.5% سنويًا'**
  String get offer_interest_charge_value;

  /// No description provided for @offer_interest_charge_value_rate.
  ///
  /// In ar, this message translates to:
  /// **'{pct}% سنويًا'**
  String offer_interest_charge_value_rate(String pct);

  /// No description provided for @offer_stamp_duty.
  ///
  /// In ar, this message translates to:
  /// **'الدمغة'**
  String get offer_stamp_duty;

  /// No description provided for @offer_life_insurance.
  ///
  /// In ar, this message translates to:
  /// **'تأمين الحياة'**
  String get offer_life_insurance;

  /// No description provided for @offer_fee_egp.
  ///
  /// In ar, this message translates to:
  /// **'{amount} جنيه'**
  String offer_fee_egp(String amount);

  /// No description provided for @offer_early_settlement.
  ///
  /// In ar, this message translates to:
  /// **'السداد المبكر'**
  String get offer_early_settlement;

  /// No description provided for @offer_early_settlement_value.
  ///
  /// In ar, this message translates to:
  /// **'مجاني بعد 12 شهرًا'**
  String get offer_early_settlement_value;

  /// No description provided for @offer_apply.
  ///
  /// In ar, this message translates to:
  /// **'تقدم بطلب لهذا العرض'**
  String get offer_apply;

  /// No description provided for @offer_save_later.
  ///
  /// In ar, this message translates to:
  /// **'احفظ العرض لاحقًا'**
  String get offer_save_later;

  /// No description provided for @offer_action_soon.
  ///
  /// In ar, this message translates to:
  /// **'قريبًا'**
  String get offer_action_soon;

  /// No description provided for @offer_proceed_success.
  ///
  /// In ar, this message translates to:
  /// **'تم إرسال طلبك إلى البنك.'**
  String get offer_proceed_success;

  /// No description provided for @offer_proceed_error.
  ///
  /// In ar, this message translates to:
  /// **'حدث خطأ ما. حاول مرة أخرى.'**
  String get offer_proceed_error;

  /// No description provided for @offer_national_id_required_title.
  ///
  /// In ar, this message translates to:
  /// **'الرقم القومي مطلوب'**
  String get offer_national_id_required_title;

  /// No description provided for @offer_national_id_required_body.
  ///
  /// In ar, this message translates to:
  /// **'قم برفع صورة الرقم القومي من الأمام والخلف للمتابعة في هذا الطلب.'**
  String get offer_national_id_required_body;

  /// No description provided for @offer_national_id_required_cta.
  ///
  /// In ar, this message translates to:
  /// **'إكمال الملف الشخصي'**
  String get offer_national_id_required_cta;

  /// No description provided for @apply_docs_title.
  ///
  /// In ar, this message translates to:
  /// **'أكمل مستنداتك'**
  String get apply_docs_title;

  /// No description provided for @apply_docs_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'أضف صورتك والرقم القومي لإرسال هذا الطلب إلى البنك.'**
  String get apply_docs_subtitle;

  /// No description provided for @apply_docs_photo_section.
  ///
  /// In ar, this message translates to:
  /// **'الصورة الشخصية'**
  String get apply_docs_photo_section;

  /// No description provided for @apply_docs_photo_hint.
  ///
  /// In ar, this message translates to:
  /// **'مطلوبة'**
  String get apply_docs_photo_hint;

  /// No description provided for @apply_docs_cta.
  ///
  /// In ar, this message translates to:
  /// **'متابعة الطلب'**
  String get apply_docs_cta;

  /// No description provided for @apply_docs_upload_error.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر رفع الملف. حاول مرة أخرى.'**
  String get apply_docs_upload_error;

  /// Backend PROFILE_PHOTO_REQUIRED error code
  ///
  /// In ar, this message translates to:
  /// **'ارفع صورتك الشخصية قبل التقديم على القرض.'**
  String get auth_profile_photo_required;

  /// No description provided for @offer_save_success.
  ///
  /// In ar, this message translates to:
  /// **'تم حفظ العرض. يمكنك إيجاده في العروض المحفوظة.'**
  String get offer_save_success;

  /// No description provided for @offer_save_error.
  ///
  /// In ar, this message translates to:
  /// **'لم نتمكن من حفظ هذا العرض. حاول مرة أخرى.'**
  String get offer_save_error;

  /// No description provided for @offer_saved.
  ///
  /// In ar, this message translates to:
  /// **'تم الحفظ'**
  String get offer_saved;

  /// No description provided for @offer_removed_success.
  ///
  /// In ar, this message translates to:
  /// **'تمت الإزالة من المحفوظات.'**
  String get offer_removed_success;

  /// No description provided for @offer_remove_error.
  ///
  /// In ar, this message translates to:
  /// **'لم نتمكن من إزالة هذا العرض. حاول مرة أخرى.'**
  String get offer_remove_error;

  /// No description provided for @settings_security_title.
  ///
  /// In ar, this message translates to:
  /// **'الإعدادات والأمان'**
  String get settings_security_title;

  /// No description provided for @settings_section_privacy_security.
  ///
  /// In ar, this message translates to:
  /// **'الخصوصية والأمان'**
  String get settings_section_privacy_security;

  /// No description provided for @settings_biometric_title.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الدخول بالبصمة'**
  String get settings_biometric_title;

  /// No description provided for @settings_biometric_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'بصمة الوجه / بصمة الإصبع'**
  String get settings_biometric_subtitle;

  /// No description provided for @settings_biometric_confirm_reason.
  ///
  /// In ar, this message translates to:
  /// **'أكّد ببصمة الوجه أو الإصبع لتفعيل تسجيل الدخول بالبصمة'**
  String get settings_biometric_confirm_reason;

  /// No description provided for @settings_biometric_unavailable.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الدخول بالبصمة غير مُعد على هذا الجهاز بعد'**
  String get settings_biometric_unavailable;

  /// No description provided for @biometric_lock_title.
  ///
  /// In ar, this message translates to:
  /// **'افتح تطبيق مصرفي ببصمة الوجه أو الإصبع'**
  String get biometric_lock_title;

  /// No description provided for @biometric_lock_reason.
  ///
  /// In ar, this message translates to:
  /// **'فتح تطبيق مصرفي'**
  String get biometric_lock_reason;

  /// No description provided for @biometric_lock_retry.
  ///
  /// In ar, this message translates to:
  /// **'حاول مرة أخرى'**
  String get biometric_lock_retry;

  /// No description provided for @biometric_lock_logout.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الخروج'**
  String get biometric_lock_logout;

  /// No description provided for @settings_privacy_policies_title.
  ///
  /// In ar, this message translates to:
  /// **'سياسات الخصوصية'**
  String get settings_privacy_policies_title;

  /// No description provided for @settings_privacy_policies_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'سياسات الخصوصية - الشروط والأحكام'**
  String get settings_privacy_policies_subtitle;

  /// No description provided for @settings_section_notification_center.
  ///
  /// In ar, this message translates to:
  /// **'مركز الإشعارات'**
  String get settings_section_notification_center;

  /// No description provided for @settings_notifications_title.
  ///
  /// In ar, this message translates to:
  /// **'تفعيل الإشعارات'**
  String get settings_notifications_title;

  /// No description provided for @settings_notifications_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'استقبال الإشعارات'**
  String get settings_notifications_subtitle;

  /// No description provided for @settings_section_languages.
  ///
  /// In ar, this message translates to:
  /// **'اللغات'**
  String get settings_section_languages;

  /// No description provided for @settings_change_language_title.
  ///
  /// In ar, this message translates to:
  /// **'تغيير اللغة'**
  String get settings_change_language_title;

  /// No description provided for @settings_language_sheet_title.
  ///
  /// In ar, this message translates to:
  /// **'تغيير اللغة'**
  String get settings_language_sheet_title;

  /// No description provided for @settings_language_english.
  ///
  /// In ar, this message translates to:
  /// **'الإنجليزية'**
  String get settings_language_english;

  /// No description provided for @settings_language_arabic.
  ///
  /// In ar, this message translates to:
  /// **'العربية'**
  String get settings_language_arabic;

  /// No description provided for @settings_change_password_title.
  ///
  /// In ar, this message translates to:
  /// **'تغيير كلمة المرور'**
  String get settings_change_password_title;

  /// No description provided for @settings_change_password_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'تحديث كلمة مرور حسابك'**
  String get settings_change_password_subtitle;

  /// No description provided for @change_password_title.
  ///
  /// In ar, this message translates to:
  /// **'تغيير كلمة المرور'**
  String get change_password_title;

  /// No description provided for @change_password_hint.
  ///
  /// In ar, this message translates to:
  /// **'أدخل كلمة المرور الحالية، ثم اختر كلمة مرور جديدة لا تقل عن ١٢ حرفًا وتحتوي على حرف كبير وحرف صغير ورقم ورمز.'**
  String get change_password_hint;

  /// No description provided for @change_password_current_label.
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور الحالية'**
  String get change_password_current_label;

  /// No description provided for @change_password_current_hint.
  ///
  /// In ar, this message translates to:
  /// **'أدخل كلمة المرور الحالية'**
  String get change_password_current_hint;

  /// No description provided for @change_password_new_label.
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور الجديدة'**
  String get change_password_new_label;

  /// No description provided for @change_password_new_hint.
  ///
  /// In ar, this message translates to:
  /// **'أدخل كلمة المرور الجديدة'**
  String get change_password_new_hint;

  /// No description provided for @change_password_confirm_label.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد كلمة المرور الجديدة'**
  String get change_password_confirm_label;

  /// No description provided for @change_password_confirm_hint.
  ///
  /// In ar, this message translates to:
  /// **'أعد إدخال كلمة المرور الجديدة'**
  String get change_password_confirm_hint;

  /// No description provided for @change_password_action.
  ///
  /// In ar, this message translates to:
  /// **'حفظ'**
  String get change_password_action;

  /// No description provided for @change_password_success.
  ///
  /// In ar, this message translates to:
  /// **'تم تغيير كلمة المرور. الرجاء تسجيل الدخول بكلمة المرور الجديدة.'**
  String get change_password_success;

  /// No description provided for @change_password_error_current_incorrect.
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور الحالية غير صحيحة.'**
  String get change_password_error_current_incorrect;

  /// No description provided for @change_password_error_same_as_old.
  ///
  /// In ar, this message translates to:
  /// **'يجب أن تختلف كلمة المرور الجديدة عن الحالية.'**
  String get change_password_error_same_as_old;

  /// No description provided for @change_password_error_social_forbidden.
  ///
  /// In ar, this message translates to:
  /// **'تغيير كلمة المرور غير متاح لحسابات تسجيل الدخول عبر مواقع التواصل.'**
  String get change_password_error_social_forbidden;

  /// No description provided for @change_password_error_policy.
  ///
  /// In ar, this message translates to:
  /// **'يجب أن تتكون كلمة المرور من ١٢ حرفًا على الأقل وتشمل حرفًا كبيرًا وصغيرًا ورقمًا ورمزًا.'**
  String get change_password_error_policy;

  /// No description provided for @change_password_error_breached.
  ///
  /// In ar, this message translates to:
  /// **'ظهرت كلمة المرور هذه في تسريب بيانات معروف. يرجى اختيار كلمة مرور مختلفة.'**
  String get change_password_error_breached;

  /// No description provided for @change_password_error_common.
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور هذه شائعة جدًا. يرجى اختيار كلمة مرور أقوى.'**
  String get change_password_error_common;

  /// No description provided for @change_password_error_breach_check_unavailable.
  ///
  /// In ar, this message translates to:
  /// **'تعذر التحقق من كلمة المرور الآن. يرجى المحاولة بعد قليل.'**
  String get change_password_error_breach_check_unavailable;

  /// No description provided for @change_password_error_account_inactive.
  ///
  /// In ar, this message translates to:
  /// **'حسابك غير نشط. يرجى التواصل مع الدعم.'**
  String get change_password_error_account_inactive;

  /// No description provided for @change_password_error_mismatch.
  ///
  /// In ar, this message translates to:
  /// **'كلمتا المرور غير متطابقتين'**
  String get change_password_error_mismatch;

  /// No description provided for @forgot_password_phone_title.
  ///
  /// In ar, this message translates to:
  /// **'إعادة تعيين كلمة المرور'**
  String get forgot_password_phone_title;

  /// No description provided for @forgot_password_phone_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'أدخل رقم هاتفك وسنرسل لك رمز تحقق.'**
  String get forgot_password_phone_subtitle;

  /// No description provided for @forgot_password_phone_hint.
  ///
  /// In ar, this message translates to:
  /// **'سنرسل رمزًا من 6 أرقام إلى هاتفك للتأكد من هويتك.'**
  String get forgot_password_phone_hint;

  /// No description provided for @forgot_password_send_cta.
  ///
  /// In ar, this message translates to:
  /// **'إرسال الرمز'**
  String get forgot_password_send_cta;

  /// No description provided for @forgot_password_otp_title.
  ///
  /// In ar, this message translates to:
  /// **'تحقق من رقم هاتفك'**
  String get forgot_password_otp_title;

  /// No description provided for @forgot_password_new_title.
  ///
  /// In ar, this message translates to:
  /// **'اختر كلمة مرور جديدة'**
  String get forgot_password_new_title;

  /// No description provided for @forgot_password_new_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'اختر كلمة مرور قوية جديدة لحسابك.'**
  String get forgot_password_new_subtitle;

  /// No description provided for @forgot_password_new_hint.
  ///
  /// In ar, this message translates to:
  /// **'اختر كلمة مرور جديدة لا تقل عن 12 حرفًا وتشمل حروفًا كبيرة وصغيرة ورقمًا ورمزًا.'**
  String get forgot_password_new_hint;

  /// No description provided for @forgot_password_reset_cta.
  ///
  /// In ar, this message translates to:
  /// **'إعادة تعيين كلمة المرور'**
  String get forgot_password_reset_cta;

  /// No description provided for @forgot_password_success.
  ///
  /// In ar, this message translates to:
  /// **'تم إعادة تعيين كلمة المرور. الرجاء تسجيل الدخول بكلمة المرور الجديدة.'**
  String get forgot_password_success;

  /// No description provided for @forgot_password_error_unavailable.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر إعادة تعيين كلمة المرور لهذا الرقم. حاول مرة أخرى أو تواصل مع الدعم.'**
  String get forgot_password_error_unavailable;

  /// No description provided for @photo_source_title.
  ///
  /// In ar, this message translates to:
  /// **'صورة الملف الشخصي'**
  String get photo_source_title;

  /// No description provided for @photo_source_camera.
  ///
  /// In ar, this message translates to:
  /// **'التقاط صورة'**
  String get photo_source_camera;

  /// No description provided for @photo_source_gallery.
  ///
  /// In ar, this message translates to:
  /// **'اختيار من المعرض'**
  String get photo_source_gallery;

  /// No description provided for @profile_photo_upload_failed.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر رفع الصورة. حاول مرة أخرى.'**
  String get profile_photo_upload_failed;

  /// Backend ANSWER_TYPE_MISMATCH error code
  ///
  /// In ar, this message translates to:
  /// **'هذه الإجابة لا تطابق نوع السؤال.'**
  String get error_answer_type_mismatch;

  /// Backend ANSWER_OUT_OF_RANGE error code
  ///
  /// In ar, this message translates to:
  /// **'هذا الرقم خارج النطاق المسموح.'**
  String get error_answer_out_of_range;

  /// Backend ANSWER_TOO_LONG error code
  ///
  /// In ar, this message translates to:
  /// **'هذه الإجابة أطول من المسموح.'**
  String get error_answer_too_long;

  /// Backend ANSWER_REQUIRED error code
  ///
  /// In ar, this message translates to:
  /// **'من فضلك أجب على هذا السؤال.'**
  String get error_answer_required;

  /// Backend MONEY_FIGURE_MISSING error code
  ///
  /// In ar, this message translates to:
  /// **'تنقص قيمة لازمة للتقدير. من فضلك راجع إجاباتك.'**
  String get error_money_figure_missing;

  /// Backend CALCULATOR_INPUT_INVALID error code
  ///
  /// In ar, this message translates to:
  /// **'من فضلك تحقق من المبلغ والمدة والدخل والأقساط الحالية.'**
  String get error_calculator_input_invalid;

  /// Backend CALCULATOR_PROGRAM_INACTIVE error code
  ///
  /// In ar, this message translates to:
  /// **'هذا البرنامج غير متاح حاليًا.'**
  String get error_calculator_program_inactive;

  /// Backend OBLIGATIONS_TOTAL_MISMATCH error code
  ///
  /// In ar, this message translates to:
  /// **'إجمالي أقساطك الشهرية غير مطابق. من فضلك راجع التزاماتك وحاول مرة أخرى.'**
  String get error_obligations_total_mismatch;

  /// Backend NO_RECOGNISED_INCOME reason code
  ///
  /// In ar, this message translates to:
  /// **'تعذّر الاعتراف بدخل شهري لهذا البرنامج.'**
  String get reason_no_recognised_income;

  /// Backend OBLIGATIONS_EXCEED_ALLOWANCE reason code
  ///
  /// In ar, this message translates to:
  /// **'أقساطك الشهرية الحالية تستهلك الحد المسموح بالكامل.'**
  String get reason_obligations_exceed_allowance;

  /// Backend BELOW_PROGRAM_MIN_AMOUNT reason code
  ///
  /// In ar, this message translates to:
  /// **'المبلغ الممكن تحمله أقل من الحد الأدنى لهذا البرنامج.'**
  String get reason_below_program_min_amount;

  /// Backend AGE_AT_MATURITY reason code
  ///
  /// In ar, this message translates to:
  /// **'لا توجد مدة متاحة تُبقيك داخل حد السن لهذا البرنامج.'**
  String get reason_age_at_maturity;

  /// Backend CURRENCY_NOT_OFFERED reason code
  ///
  /// In ar, this message translates to:
  /// **'هذا البرنامج لا يوفر العملة المطلوبة.'**
  String get reason_currency_not_offered;

  /// Backend PROGRAM_MISCONFIGURED reason code
  ///
  /// In ar, this message translates to:
  /// **'لا يمكن تسعير هذا البرنامج حاليًا.'**
  String get reason_program_misconfigured;

  /// Backend INDICATIVE_ESTIMATE_NOT_AN_OFFER disclaimer code
  ///
  /// In ar, this message translates to:
  /// **'تقدير استرشادي وليس عرضًا ملزمًا. الأرقام النهائية تصدر من البنك.'**
  String get disclaimer_indicative_estimate;
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>['ar', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {


  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar': return AppLocalizationsAr();
    case 'en': return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.'
  );
}
