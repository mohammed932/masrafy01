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
  /// **'لا توجد كلمة مرور لهذا الحساب. سجل الدخول عبر Google أو Apple.'**
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

  /// Backend PASSWORD_REQUIRED_FOR_PHONE_PROFILE error code
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور مطلوبة لإكمال ملفك.'**
  String get auth_password_required_for_phone_profile;

  /// Backend PASSWORD_FORBIDDEN_FOR_SOCIAL_PROFILE error code
  ///
  /// In ar, this message translates to:
  /// **'حسابات Google أو Apple لا تستخدم كلمة مرور.'**
  String get auth_password_forbidden_for_social_profile;

  /// Backend PHONE_MUTATION_ON_PHONE_CUSTOMER_FORBIDDEN error code
  ///
  /// In ar, this message translates to:
  /// **'رقم الجوال مضبوط بالفعل على هذا الحساب.'**
  String get auth_phone_mutation_on_phone_customer_forbidden;

  /// Backend PASSWORD_CHANGE_FORBIDDEN_FOR_SOCIAL error code
  ///
  /// In ar, this message translates to:
  /// **'تغيير كلمة المرور غير متاح لحسابات Google أو Apple.'**
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

  /// Landing CTA — Apple sign-in (iOS only)
  ///
  /// In ar, this message translates to:
  /// **'المتابعة باستخدام Apple'**
  String get auth_landing_action_apple;

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
