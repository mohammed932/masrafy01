import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get auth_otp_invalid => 'الرمز غير صحيح. حاول مرة أخرى.';

  @override
  String get auth_otp_expired => 'انتهت صلاحية الرمز. اطلب رمزًا جديدًا.';

  @override
  String get auth_otp_consumed => 'تم استخدام هذا الرمز بالفعل.';

  @override
  String get auth_otp_attempts_exceeded => 'عدد المحاولات الخاطئة كبير. اطلب رمزًا جديدًا.';

  @override
  String get auth_otp_rate_limited => 'طلبات كثيرة. انتظر قليلاً وحاول مجددًا.';

  @override
  String get auth_otp_purpose_login_forbidden => 'لا حاجة لرمز SMS لتسجيل الدخول. استخدم كلمة المرور.';

  @override
  String get auth_verified_mobile_token_invalid => 'رمز التحقق غير صالح. ابدأ التسجيل من جديد.';

  @override
  String get auth_verified_mobile_token_expired => 'انتهت صلاحية رمز التحقق. ابدأ التسجيل من جديد.';

  @override
  String get auth_verified_mobile_token_consumed => 'تم استخدام رمز التحقق بالفعل.';

  @override
  String get auth_social_token_invalid => 'فشل تسجيل الدخول. حاول مرة أخرى.';

  @override
  String get auth_social_token_expired => 'انتهت جلسة تسجيل الدخول. حاول مرة أخرى.';

  @override
  String get auth_social_provider_unavailable => 'خدمة تسجيل الدخول غير متاحة مؤقتًا.';

  @override
  String get auth_social_session_invalid => 'جلسة تسجيل الدخول غير صالحة.';

  @override
  String get auth_social_session_expired => 'انتهت جلسة تسجيل الدخول. اضغط زر مزود الخدمة مجددًا.';

  @override
  String get auth_social_session_consumed => 'تم استخدام جلسة تسجيل الدخول بالفعل.';

  @override
  String get auth_account_locked => 'تم قفل الحساب مؤقتًا بسبب محاولات فاشلة كثيرة. حاول لاحقًا.';

  @override
  String get auth_password_not_set => 'لا توجد كلمة مرور لهذا الحساب. سجل الدخول عبر Google أو Apple.';

  @override
  String get auth_password_same_as_old => 'اختر كلمة مرور مختلفة عن الحالية.';

  @override
  String get auth_profile_incomplete => 'أكمل بيانات حسابك للمتابعة.';

  @override
  String get auth_profile_field_immutable => 'لا يمكن تعديل هذا الحقل بعد ضبطه.';

  @override
  String get auth_profile_id_docs_missing => 'ارفع وجهي بطاقة الرقم القومي قبل إكمال ملفك.';

  @override
  String get auth_password_required_for_phone_profile => 'كلمة المرور مطلوبة لإكمال ملفك.';

  @override
  String get auth_password_forbidden_for_social_profile => 'حسابات Google أو Apple لا تستخدم كلمة مرور.';

  @override
  String get auth_phone_mutation_on_phone_customer_forbidden => 'رقم الجوال مضبوط بالفعل على هذا الحساب.';

  @override
  String get auth_password_change_forbidden_for_social => 'تغيير كلمة المرور غير متاح لحسابات Google أو Apple.';

  @override
  String get auth_age_invalid => 'العمر يجب أن يكون بين 18 و80 سنة.';

  @override
  String get auth_documents_missing => 'كلا وجهي بطاقة الرقم القومي مطلوبان.';

  @override
  String get auth_documents_not_owned => 'هذه المستندات لا تخص حسابك.';

  @override
  String get auth_bank_program_invalid => 'هذا العرض لم يعد متاحًا لملفك.';

  @override
  String get auth_landing_brand => 'مصرفي';

  @override
  String get auth_landing_action_phone_signup => 'إنشاء حساب بالهاتف';

  @override
  String get auth_landing_action_google => 'المتابعة باستخدام Google';

  @override
  String get auth_landing_action_apple => 'المتابعة باستخدام Apple';

  @override
  String get auth_landing_action_login => 'تسجيل الدخول';

  @override
  String get auth_login_title => 'تسجيل الدخول';

  @override
  String get auth_login_field_mobile => 'رقم الموبايل';

  @override
  String get auth_login_field_password => 'كلمة المرور';

  @override
  String get auth_login_action_submit => 'تسجيل الدخول';

  @override
  String get auth_login_action_forgot => 'نسيت كلمة المرور؟';

  @override
  String get auth_forgot_password_title_request => 'استرداد كلمة المرور';

  @override
  String get auth_forgot_password_title_verify => 'التحقق من الكود';

  @override
  String get auth_forgot_password_title_reset => 'كلمة مرور جديدة';

  @override
  String get auth_forgot_password_field_mobile => 'رقم الموبايل';

  @override
  String get auth_forgot_password_field_otp => 'كود مكون من 6 أرقام';

  @override
  String get auth_forgot_password_field_new_password => 'كلمة مرور جديدة';

  @override
  String get auth_forgot_password_field_confirm_password => 'تأكيد كلمة المرور الجديدة';

  @override
  String get auth_forgot_password_action_send => 'إرسال الكود';

  @override
  String get auth_forgot_password_action_verify => 'تحقق';

  @override
  String get auth_forgot_password_action_reset => 'إعادة تعيين كلمة المرور';

  @override
  String get auth_forgot_password_validation_password_min => '8 أحرف على الأقل';

  @override
  String get auth_forgot_password_validation_password_letter => 'حرف واحد على الأقل';

  @override
  String get auth_forgot_password_validation_password_digit => 'رقم واحد على الأقل';

  @override
  String get auth_forgot_password_validation_password_mismatch => 'غير متطابقة';

  @override
  String get auth_phone_signup_title_phone => 'إنشاء حساب — الموبايل';

  @override
  String get auth_phone_signup_title_verify => 'التحقق من الكود';

  @override
  String get auth_phone_signup_title_details => 'بياناتك';

  @override
  String get auth_phone_signup_field_mobile => 'رقم الموبايل';

  @override
  String get auth_phone_signup_field_mobile_hint => '01001234567';

  @override
  String get auth_phone_signup_field_otp => 'كود مكون من 6 أرقام';

  @override
  String get auth_phone_signup_field_name => 'الاسم بالكامل';

  @override
  String get auth_phone_signup_field_email => 'البريد الإلكتروني';

  @override
  String get auth_phone_signup_field_password => 'كلمة المرور';

  @override
  String get auth_phone_signup_field_password_confirm => 'تأكيد كلمة المرور';

  @override
  String get auth_phone_signup_field_age => 'العمر';

  @override
  String get auth_phone_signup_action_send => 'إرسال الكود';

  @override
  String get auth_phone_signup_action_verify => 'تحقق';

  @override
  String get auth_phone_signup_action_create => 'إنشاء الحساب';

  @override
  String get auth_phone_signup_validation_required => 'مطلوب';

  @override
  String get auth_phone_signup_validation_email_invalid => 'بريد إلكتروني غير صالح';

  @override
  String get auth_phone_signup_validation_password_min => '8 أحرف على الأقل';

  @override
  String get auth_phone_signup_validation_password_letter => 'حرف واحد على الأقل';

  @override
  String get auth_phone_signup_validation_password_digit => 'رقم واحد على الأقل';

  @override
  String get auth_phone_signup_validation_password_mismatch => 'غير متطابقة';

  @override
  String get auth_phone_signup_validation_age_range => 'من 18 إلى 80';

  @override
  String get auth_complete_profile_title => 'أكمل ملفك الشخصي';

  @override
  String get auth_complete_profile_body => 'نحتاج لبعض البيانات الإضافية قبل التقديم. هذه البيانات مطلوبة من البنك.';

  @override
  String get auth_complete_profile_action_cancel => 'إلغاء';

  @override
  String get auth_complete_profile_action_complete => 'إكمال الملف';

  @override
  String get auth_complete_profile_title_mobile => 'إكمال الملف — الموبايل';

  @override
  String get auth_complete_profile_title_verify => 'التحقق من الكود';

  @override
  String get auth_complete_profile_title_email => 'البريد الإلكتروني';

  @override
  String get auth_complete_profile_title_age => 'العمر';

  @override
  String get auth_complete_profile_field_mobile => 'رقم الموبايل';

  @override
  String get auth_complete_profile_field_otp => 'كود مكون من 6 أرقام';

  @override
  String get auth_complete_profile_field_email => 'البريد الإلكتروني';

  @override
  String get auth_complete_profile_field_age => 'العمر (18–80)';

  @override
  String get auth_complete_profile_action_send => 'إرسال الكود';

  @override
  String get auth_complete_profile_action_verify => 'تحقق';

  @override
  String get auth_complete_profile_action_continue => 'متابعة';

  @override
  String get match_questionnaire_not_published => 'الاستبيان غير متاح حاليًا. حاول لاحقًا.';

  @override
  String get match_unknown_question_code => 'إجاباتك قديمة. أعد بدء الاستبيان.';

  @override
  String get match_unknown_option_code => 'إجاباتك قديمة. أعد بدء الاستبيان.';

  @override
  String get match_program_no_longer_matches => 'هذا العرض لم يعد متاحًا لإجاباتك.';

  @override
  String get questionnaire_form_title => 'أخبرنا عن قرضك';

  @override
  String get questionnaire_form_action_submit => 'عرض النتائج المطابقة';

  @override
  String get match_preview_title => 'النتائج المطابقة لك';

  @override
  String get match_preview_no_matches => 'لا توجد برامج تطابق إجاباتك بعد. حاول تعديلها.';

  @override
  String get match_preview_section_suggestions => 'طرق لفتح المزيد من العروض';

  @override
  String get match_preview_required_documents => 'المستندات المطلوبة';

  @override
  String get match_preview_rejection_reasons => 'سبب عدم الأهلية';

  @override
  String get match_preview_monthly_installment => 'القسط الشهري';

  @override
  String get match_preview_effective_rate => 'الفائدة الفعلية';

  @override
  String match_preview_suggestion_unlock(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'يفتح $count برنامج إضافي',
      many: 'يفتح $count برنامجًا إضافيًا',
      few: 'يفتح $count برامج إضافية',
      two: 'يفتح برنامجين إضافيين',
      one: 'يفتح برنامجًا إضافيًا واحدًا',
      zero: 'قد يساعد تعديل هذه الإجابة',
    );
    return '$_temp0';
  }

  @override
  String get match_featured_badge => 'مميز';

  @override
  String get match_tier_excellent => 'فرصة ممتازة';

  @override
  String get match_tier_good => 'فرصة جيدة';

  @override
  String get match_tier_moderate => 'فرصة متوسطة';

  @override
  String get match_tier_low => 'فرصة منخفضة';

  @override
  String get match_tier_very_low => 'فرصة منخفضة جدًا';
}
