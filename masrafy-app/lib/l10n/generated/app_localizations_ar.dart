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
  String get auth_phone_already_registered => 'هذا الرقم مسجل بالفعل. برجاء تسجيل الدخول.';

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
  String get auth_password_not_set => 'لا توجد كلمة مرور لهذا الحساب. سجل الدخول عبر Google.';

  @override
  String get auth_password_same_as_old => 'اختر كلمة مرور مختلفة عن الحالية.';

  @override
  String get auth_profile_incomplete => 'أكمل بيانات حسابك للمتابعة.';

  @override
  String get auth_profile_field_immutable => 'لا يمكن تعديل هذا الحقل بعد ضبطه.';

  @override
  String get auth_profile_id_docs_missing => 'ارفع وجهي بطاقة الرقم القومي قبل إكمال ملفك.';

  @override
  String get auth_national_id_required => 'ارفع بطاقة الرقم القومي (الوجه والظهر) قبل التقديم على القرض.';

  @override
  String get auth_password_required_for_phone_profile => 'كلمة المرور مطلوبة لإكمال ملفك.';

  @override
  String get auth_password_forbidden_for_social_profile => 'حسابات Google لا تستخدم كلمة مرور.';

  @override
  String get auth_phone_mutation_on_phone_customer_forbidden => 'رقم الجوال مضبوط بالفعل على هذا الحساب.';

  @override
  String get auth_password_change_forbidden_for_social => 'تغيير كلمة المرور غير متاح لحسابات Google.';

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
  String get match_program_name_key_unknown => 'هذا البرنامج لم يعد متاحًا. اختر برنامجًا آخر.';

  @override
  String get match_program_name_not_in_category => 'هذا البرنامج غير متاح لهذا النوع من التمويل. اختر برنامجًا آخر.';

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

  @override
  String get match_tier_unknown => 'تقدير غير محدد';

  @override
  String get match_action_retry => 'إعادة المحاولة';

  @override
  String get match_generic_error => 'حدث خطأ ما. حاول مرة أخرى.';

  @override
  String get match_network_error => 'لا يوجد اتصال. تحقق من الشبكة وحاول مجددًا.';

  @override
  String get match_preview_adjust_answers => 'تعديل إجاباتي';

  @override
  String get questionnaire_form_submit_hint => 'أجب عن جميع الأسئلة المطلوبة لعرض العروض.';

  @override
  String match_amount_egp(String value) {
    return '$value ج.م';
  }

  @override
  String match_rate_percent(String value) {
    return '$value٪';
  }

  @override
  String get common_coming_soon => 'قريبًا';

  @override
  String get common_cancel => 'إلغاء';

  @override
  String get error_invalid_credentials => 'رقم الهاتف أو كلمة المرور غير صحيحة.';

  @override
  String get error_network => 'لا يوجد اتصال. تحقق من الشبكة وحاول مجددًا.';

  @override
  String get error_generic => 'حدث خطأ ما. حاول مرة أخرى.';

  @override
  String get error_image_too_large => 'هذه الصورة كبيرة جدًا. اختر صورة أصغر.';

  @override
  String get error_rate_limited => 'محاولات كثيرة. انتظر قليلاً وحاول مجددًا.';

  @override
  String get onboarding_slide1_title => 'اكتشف عروض قروض مصمّمة لك.';

  @override
  String get onboarding_slide1_body => 'نبحث في عدة بنوك رائدة لإيجاد أفضل الأسعار والشروط المناسبة لملفك تحديدًا.';

  @override
  String get onboarding_slide2_title => 'قارن العروض في ثوانٍ.';

  @override
  String get onboarding_slide2_body => 'قروض شخصية وسيارات وعقارية وأعمال — جنبًا إلى جنب، بأسعار وحدود واضحة.';

  @override
  String get onboarding_slide3_title => 'تقدّم بثقة.';

  @override
  String get onboarding_slide3_body => 'نطابقك مع العروض، ثم تتقدّم للعرض الأنسب لك. مجاني لك دائمًا.';

  @override
  String get onboarding_next => 'التالي';

  @override
  String get onboarding_skip => 'تخطّي';

  @override
  String get onboarding_signin => 'تسجيل الدخول';

  @override
  String get onboarding_or_continue => 'أو تابع باستخدام';

  @override
  String get onboarding_google => 'Google';

  @override
  String get onboarding_lang_toggle => 'English';

  @override
  String get login_title => 'سجّل الدخول إلى حسابك';

  @override
  String get login_subtitle => 'سجّل الدخول لاكتشاف أفضل عروض القروض';

  @override
  String get login_identifier_label => 'البريد الإلكتروني';

  @override
  String get login_identifier_hint => 'ahmed@masrafy.io';

  @override
  String get login_password_label => 'كلمة المرور';

  @override
  String get login_password_hint => 'أدخل كلمة المرور';

  @override
  String get login_forgot => 'هل نسيت كلمة المرور؟';

  @override
  String get login_cta => 'تسجيل الدخول';

  @override
  String get login_or_continue => 'أو تابع باستخدام';

  @override
  String get login_google => 'Google';

  @override
  String get login_no_account => 'ليس لديك حساب؟';

  @override
  String get login_create_account => 'إنشاء حساب';

  @override
  String get login_terms => 'بالتسجيل، أنت توافق على شروط الخدمة';

  @override
  String get signup_title => 'أنشئ حسابك';

  @override
  String get signup_subtitle => 'سجّل لاكتشاف أفضل عروض القروض';

  @override
  String get signup_photo_upload => 'رفع';

  @override
  String get signup_photo_optional => 'اختياري';

  @override
  String get signup_first_name_label => 'الاسم الأول';

  @override
  String get signup_first_name_hint => 'محمد';

  @override
  String get signup_last_name_label => 'اسم العائلة';

  @override
  String get signup_last_name_hint => 'إسكندر';

  @override
  String get signup_phone_code_label => 'رمز الدولة';

  @override
  String get signup_phone_label => 'رقم الهاتف';

  @override
  String get signup_phone_hint => '101 234 5678';

  @override
  String get signup_email_label => 'البريد الإلكتروني';

  @override
  String get signup_email_hint => 'ahmed@example.com';

  @override
  String get signup_dob_label => 'تاريخ الميلاد';

  @override
  String get signup_dob_day => 'اليوم';

  @override
  String get signup_dob_month => 'الشهر';

  @override
  String get signup_dob_year => 'السنة';

  @override
  String get signup_dob_hint => 'اختر تاريخ الميلاد';

  @override
  String signup_age_verified(Object years) {
    return 'تم التحقق من العمر — $years سنة';
  }

  @override
  String get signup_password_label => 'كلمة المرور';

  @override
  String get signup_password_hint => 'أنشئ كلمة مرور';

  @override
  String get signup_confirm_password_label => 'تأكيد كلمة المرور';

  @override
  String get signup_confirm_password_hint => 'أعد إدخال كلمة المرور';

  @override
  String get signup_national_id_label => 'الرقم القومي';

  @override
  String get signup_national_id_hint => '— اختياري الآن، مطلوب عند اختيار العرض';

  @override
  String get signup_id_front => 'الوجه الأمامي';

  @override
  String get signup_id_back => 'الوجه الخلفي';

  @override
  String get signup_id_tap_to_upload => 'اضغط للتصوير';

  @override
  String get signup_id_captured => 'تم التصوير';

  @override
  String get signup_id_unavailable => 'اضغط لإعادة الرفع';

  @override
  String get signup_id_upload_deferred => 'تم إنشاء حسابك، لكن تعذّر رفع الرقم القومي. أضِفه من ملفك الشخصي.';

  @override
  String get signup_terms => 'أوافق على شروط الخدمة وسياسة الخصوصية الخاصة بمصرفي، وأوافق على معالجة بياناتي المالية.';

  @override
  String get signup_cta => 'إنشاء الحساب';

  @override
  String get signup_have_account => 'لديك حساب بالفعل؟';

  @override
  String get signup_sign_in => 'تسجيل الدخول';

  @override
  String get phone_verification_title => 'أضف رقم هاتفك';

  @override
  String get phone_verification_subtitle => 'نحتاج رقم هاتفك لتأمين حسابك. سنرسل لك رمز تحقق.';

  @override
  String get phone_verification_cta => 'إرسال رمز التحقق';

  @override
  String get otp_title => 'تحقّق من رقم هاتفك';

  @override
  String otp_subtitle(Object destination) {
    return 'أرسلنا رمزًا من 6 أرقام إلى $destination. أدخله بالأسفل.';
  }

  @override
  String get otp_enter_code => 'أدخل رمز التحقق';

  @override
  String otp_attempts_left(Object count) {
    return '$count محاولات متبقية';
  }

  @override
  String get otp_resend_in => 'إعادة إرسال الرمز خلال';

  @override
  String get otp_resend_action => 'إعادة إرسال الرمز';

  @override
  String otp_expiry_notice(Object minutes) {
    return 'ينتهي هذا الرمز خلال $minutes دقائق. لا تشاركه مع أحد — لن يطلبه منك مصرفي أبدًا.';
  }

  @override
  String get otp_verify_cta => 'تحقّق وتابع';

  @override
  String get otp_didnt_receive => 'لم يصلك الرمز؟';

  @override
  String get otp_wrong_number => 'رقم خاطئ؟';

  @override
  String get otp_change_phone => 'تغيير الرقم';

  @override
  String get home_title => 'ما نوع القرض الذي تبحث عنه؟';

  @override
  String get home_subtitle => 'مستشار القروض جاهز لمساعدتك';

  @override
  String get home_loan_types => 'أنواع القروض';

  @override
  String get home_program_label => 'برنامج التمويل';

  @override
  String get home_program_hint => 'اختر البرنامج';

  @override
  String get home_program_search_hint => 'ابحث عن برنامج';

  @override
  String get home_continue => 'متابعة';

  @override
  String get home_support_label => 'الدعم';

  @override
  String get home_support_title => 'اسأل مصرفي عن أي شيء';

  @override
  String get home_nav_loans => 'قروضي';

  @override
  String get home_nav_home => 'الرئيسية';

  @override
  String get home_nav_menu => 'الحساب';

  @override
  String get account_title => 'الحساب';

  @override
  String get account_row_profile => 'حسابي';

  @override
  String get account_row_settings_security => 'الإعدادات والأمان';

  @override
  String get account_row_saved_offers => 'العروض المحفوظة';

  @override
  String get account_row_notifications => 'مركز الإشعارات';

  @override
  String get account_row_previous_applications => 'الطلبات السابقة';

  @override
  String get account_row_logout => 'تسجيل الخروج';

  @override
  String get account_logout_confirm_title => 'تسجيل الخروج من مصرفي؟';

  @override
  String get account_logout_confirm_message => 'سيتم إعادتك إلى شاشة تسجيل الدخول.';

  @override
  String get account_logout_confirm_action => 'تسجيل الخروج';

  @override
  String get account_logout_confirm_cancel => 'إلغاء';

  @override
  String get saved_offers_empty_title => 'لا توجد عروض محفوظة بعد';

  @override
  String get saved_offers_empty_body => 'ستظهر هنا العروض التي تحفظها.';

  @override
  String get saved_offers_remove => 'إزالة';

  @override
  String get saved_offers_remove_failed => 'تعذّر إزالة العرض. حاول مرة أخرى.';

  @override
  String get error_saved_offer_not_found => 'هذا العرض ليس ضمن عروضك المحفوظة.';

  @override
  String get previous_applications_title => 'الطلبات';

  @override
  String get previous_applications_empty_title => 'لا توجد طلبات بعد';

  @override
  String get previous_applications_empty_body => 'تقدم بطلب لعرض وسيظهر هنا.';

  @override
  String get previous_applications_status_applied => 'تم التقديم';

  @override
  String get previous_applications_status_approved => 'تمت الموافقة';

  @override
  String get previous_applications_status_rejected => 'مرفوض';

  @override
  String get home_cat_personal => 'شخصي';

  @override
  String get home_cat_mortgage => 'عقاري';

  @override
  String get home_cat_car => 'سيارة';

  @override
  String get home_cat_business => 'أعمال';

  @override
  String get q_common_yes => 'نعم';

  @override
  String get q_common_no => 'لا';

  @override
  String get q_common_currency_egp => 'ج.م';

  @override
  String get q_common_save => 'حفظ';

  @override
  String get q_common_cancel => 'إلغاء';

  @override
  String get q_common_search => 'بحث';

  @override
  String get q_mortgage_title => 'طلب تمويل عقاري';

  @override
  String get q_mortgage_subtitle => 'سنطابقك مع البنوك المتخصصة في احتياجاتك';

  @override
  String get q_mortgage_next => 'التالي';

  @override
  String get q_mortgage_finish => 'إنهاء';

  @override
  String get q_mortgage_submitted => 'تم حفظ إجاباتك';

  @override
  String get q_mortgage_step1_title => 'بيانات العقار والتمويل';

  @override
  String get q_mortgage_step2_title => 'الوظيفة والدخل';

  @override
  String get q_mortgage_step3_title => 'السجل الائتماني';

  @override
  String get q_mortgage_step4_title => 'التفضيلات';

  @override
  String get q_mortgage_select_hint => 'اختر';

  @override
  String q_mortgage_years(Object years) {
    return '$years سنة';
  }

  @override
  String get q_mortgage_q_property_type => 'ما نوع العقار الذي ترغب في تمويله؟';

  @override
  String get q_mortgage_hint_property_type => 'اختر نوع العقار';

  @override
  String get q_opt_property_apartment => 'شقة';

  @override
  String get q_opt_property_villa => 'فيلا';

  @override
  String get q_opt_property_duplex => 'دوبلكس';

  @override
  String get q_opt_property_commercial => 'محل تجاري';

  @override
  String get q_opt_property_office => 'مكتب إداري';

  @override
  String get q_opt_property_other => 'أخرى';

  @override
  String get q_mortgage_q_in_compound => 'هل يقع العقار داخل كمبوند سكني؟';

  @override
  String get q_mortgage_q_registration_status => 'ما حالة تسجيل العقار؟';

  @override
  String get q_opt_reg_registered => 'مسجل رسميًا';

  @override
  String get q_opt_reg_eligible => 'قابل للتسجيل';

  @override
  String get q_opt_reg_not_registered => 'غير مسجل';

  @override
  String get q_opt_reg_unsure => 'غير متأكد';

  @override
  String get q_mortgage_q_address => 'ما هو عنوان العقار؟';

  @override
  String get q_mortgage_hint_governorate => 'اختر المحافظة';

  @override
  String get q_mortgage_address_label => 'العنوان';

  @override
  String get q_mortgage_address_hint => 'الشارع، المبنى، المنطقة';

  @override
  String get q_mortgage_q_property_value => 'ما هي القيمة التقريبية للعقار؟';

  @override
  String get q_mortgage_q_down_payment => 'كم نسبة المقدم المتوفر لديك حاليًا؟ (٪)';

  @override
  String get q_mortgage_hint_down_payment => 'المقدم';

  @override
  String get q_opt_dp_under10 => 'أقل من ١٠٪';

  @override
  String get q_opt_dp_10_20 => '١٠٪ – ٢٠٪';

  @override
  String get q_opt_dp_20_30 => '٢٠٪ – ٣٠٪';

  @override
  String get q_opt_dp_over30 => 'أكثر من ٣٠٪';

  @override
  String get q_mortgage_q_repayment_period => 'ما مدة السداد المناسبة لك؟';

  @override
  String get q_mortgage_repayment_label => 'مدة السداد';

  @override
  String get q_mortgage_q_employment => 'ما هي حالتك الوظيفية؟';

  @override
  String get q_opt_emp_government => 'موظف حكومي';

  @override
  String get q_opt_emp_private => 'موظف قطاع خاص';

  @override
  String get q_opt_emp_business_owner => 'صاحب عمل';

  @override
  String get q_opt_emp_freelancer => 'عمل حر';

  @override
  String get q_opt_emp_retired => 'متقاعد';

  @override
  String get q_mortgage_q_income => 'ما متوسط دخلك الشهري؟';

  @override
  String get q_mortgage_hint_income => 'الدخل الشهري';

  @override
  String get q_opt_income_b1 => 'أقل من ٥٠٬٠٠٠ ج.م';

  @override
  String get q_opt_income_b2 => '٥٠٬٠٠٠ – ١٠٠٬٠٠٠ ج.م';

  @override
  String get q_opt_income_b3 => '١٠٠٬٠٠٠ – ٣٠٠٬٠٠٠ ج.م';

  @override
  String get q_opt_income_b4 => '٣٠٠٬٠٠٠ – ٦٠٠٬٠٠٠ ج.م';

  @override
  String get q_opt_income_b5 => '٦٠٠٬٠٠٠ – ١٬٠٠٠٬٠٠٠ ج.م';

  @override
  String get q_opt_income_b6 => 'أكثر من ١٬٠٠٠٬٠٠٠ ج.م';

  @override
  String get q_mortgage_q_salary_transfer => 'هل يتم تحويل راتبك إلى حساب بنكي؟';

  @override
  String get q_mortgage_q_additional_income => 'هل لديك مصادر دخل إضافية؟';

  @override
  String get q_mortgage_q_current_loans => 'هل لديك حاليًا أي قروض أو التزامات مالية؟';

  @override
  String get q_mortgage_q_installments => 'ما إجمالي قيمة أقساطك الشهرية؟';

  @override
  String get q_mortgage_installments_label => 'الأقساط الشهرية';

  @override
  String get q_mortgage_installments_hint => 'قيمة القسط الشهري';

  @override
  String get q_mortgage_q_prior_rejection => 'هل سبق ورُفض لك طلب تمويل عقاري؟';

  @override
  String get q_mortgage_q_priority => 'ما الأهم بالنسبة لك في التمويل العقاري؟';

  @override
  String get q_opt_priority_lowest_installment => 'أقل قسط شهري';

  @override
  String get q_opt_priority_longest_period => 'أطول مدة سداد';

  @override
  String get q_opt_priority_lowest_down_payment => 'أقل مقدم';

  @override
  String get q_opt_priority_fastest_approval => 'أسرع موافقة';

  @override
  String get q_opt_priority_lowest_fees => 'أقل مصاريف إدارية';

  @override
  String get q_mortgage_q_assistance => 'هل تحتاج إلى مساعدة في تجهيز المستندات وإتمام الإجراءات؟';

  @override
  String get q_business_title => 'طلب تمويل تجاري';

  @override
  String get q_business_subtitle => 'سنطابقك مع البنوك المتخصصة في احتياجاتك';

  @override
  String get q_business_next => 'التالي';

  @override
  String get q_business_finish => 'إنهاء';

  @override
  String get q_business_submitted => 'تم حفظ إجاباتك';

  @override
  String get q_business_select_hint => 'اختر';

  @override
  String q_business_years(Object years) {
    return '$years سنة';
  }

  @override
  String get q_business_step1_title => 'بيانات النشاط والتمويل';

  @override
  String get q_business_step2_title => 'المعلومات المالية';

  @override
  String get q_business_step3_title => 'الالتزامات والوضع الائتماني';

  @override
  String get q_business_step4_title => 'التفضيلات والدعم';

  @override
  String get q_business_q_activity => 'ما نوع النشاط أو المشروع الذي تديره؟';

  @override
  String get q_business_hint_activity => 'اختر نوع النشاط';

  @override
  String get q_opt_biz_activity_trade => 'تجارة';

  @override
  String get q_opt_biz_activity_services => 'خدمات';

  @override
  String get q_opt_biz_activity_food => 'مطاعم ومقاهي';

  @override
  String get q_opt_biz_activity_manufacturing => 'تصنيع';

  @override
  String get q_opt_biz_activity_technology => 'تكنولوجيا';

  @override
  String get q_opt_biz_activity_other => 'أخرى';

  @override
  String get q_business_q_business_age => 'منذ متى يعمل النشاط؟';

  @override
  String get q_business_business_age_hint => 'عدد السنوات';

  @override
  String get q_business_q_financing_amount => 'ما قيمة التمويل التقريبية المطلوبة؟';

  @override
  String get q_business_financing_amount_hint => 'قيمة التمويل المطلوبة';

  @override
  String get q_business_q_purpose => 'ما الغرض الأساسي من التمويل؟';

  @override
  String get q_business_hint_purpose => 'اختر الغرض';

  @override
  String get q_opt_biz_purpose_expansion => 'توسعة';

  @override
  String get q_opt_biz_purpose_equipment => 'شراء معدات';

  @override
  String get q_opt_biz_purpose_working_capital => 'رأس مال تشغيلي';

  @override
  String get q_opt_biz_purpose_new_branch => 'افتتاح فرع جديد';

  @override
  String get q_opt_biz_purpose_settle_obligations => 'سداد التزامات';

  @override
  String get q_opt_biz_purpose_other => 'أخرى';

  @override
  String get q_business_repayment_label => 'مدة السداد';

  @override
  String get q_business_q_revenue => 'ما متوسط الإيراد الشهري للنشاط؟';

  @override
  String get q_business_q_bank_account => 'هل لديك حساب بنكي للنشاط؟';

  @override
  String get q_business_q_registered => 'هل النشاط مسجل رسميًا؟';

  @override
  String get q_opt_biz_registration_in_progress => 'التسجيل قيد التنفيذ';

  @override
  String get q_business_q_tax => 'هل لديك سجل ضريبي أو سجل تجاري؟';

  @override
  String get q_business_q_current_facilities => 'هل لدى النشاط حاليًا أي قروض أو تسهيلات تمويلية؟';

  @override
  String get q_business_q_installments => 'ما إجمالي قيمة الالتزامات الشهرية الحالية؟';

  @override
  String get q_business_installments_label => 'الالتزامات الشهرية';

  @override
  String get q_business_installments_hint => 'قيمة القسط الشهري';

  @override
  String get q_business_q_prior_rejection => 'هل سبق ورُفض للنشاط طلب تمويل؟';

  @override
  String get q_business_q_priority => 'ما الأهم بالنسبة لك في تمويل الأعمال؟';

  @override
  String get q_opt_biz_priority_fast_approval => 'أسرع موافقة';

  @override
  String get q_opt_biz_priority_flexible_repayment => 'سداد مرن';

  @override
  String get q_opt_biz_priority_highest_amount => 'أعلى مبلغ تمويل';

  @override
  String get q_opt_biz_priority_lowest_interest => 'أقل سعر فائدة';

  @override
  String get q_opt_biz_priority_least_paperwork => 'أقل مستندات مطلوبة';

  @override
  String get q_business_q_consultation => 'هل ترغب في استشارة خبير تمويل الأعمال؟';

  @override
  String get q_car_subtitle => 'سنطابقك مع البنوك المتخصصة في احتياجاتك';

  @override
  String get q_car_next => 'التالي';

  @override
  String get q_car_finish => 'إنهاء';

  @override
  String get q_car_submitted => 'تم حفظ إجاباتك';

  @override
  String get q_car_select_hint => 'اختر';

  @override
  String q_car_years(Object years) {
    return '$years سنة';
  }

  @override
  String get q_car_step1_title => 'معلومات السيارة والتمويل';

  @override
  String get q_car_step2_title => 'العمل والدخل';

  @override
  String get q_car_step3_title => 'الحالة المالية';

  @override
  String get q_car_step4_title => 'التفضيلات';

  @override
  String get q_car_q_condition => 'هل السيارة جديدة أم مستعملة؟';

  @override
  String get q_opt_car_cond_new => 'جديدة';

  @override
  String get q_opt_car_cond_used => 'مستعملة';

  @override
  String get q_car_q_model_year => 'ما سنة موديل السيارة؟';

  @override
  String get q_opt_car_year_current => 'موديل السنة الحالية';

  @override
  String get q_opt_car_year_last3 => 'خلال آخر 3 سنوات';

  @override
  String get q_opt_car_year_3_5 => 'من 3 إلى 5 سنوات';

  @override
  String get q_opt_car_year_over5 => 'أكثر من 5 سنوات';

  @override
  String get q_car_q_price => 'ما السعر التقريبي للسيارة؟';

  @override
  String get q_car_q_down_payment => 'ما حجم الدفعة المقدمة المتاحة لديك؟';

  @override
  String get q_opt_car_dp_none => 'بدون دفعة مقدمة';

  @override
  String get q_opt_car_dp_under20 => 'أقل من 20%';

  @override
  String get q_opt_car_dp_20_40 => '20% – 40%';

  @override
  String get q_opt_car_dp_over40 => 'أكثر من 40%';

  @override
  String get q_car_repayment_label => 'مدة السداد';

  @override
  String get q_car_q_employment => 'ما هي حالتك الوظيفية؟';

  @override
  String get q_car_q_income => 'ما متوسط دخلك الشهري؟';

  @override
  String get q_opt_car_income_b1 => 'أقل من 10,000 جنيه';

  @override
  String get q_opt_car_income_b2 => '10,000 – 25,000 جنيه';

  @override
  String get q_opt_car_income_b3 => '25,000 – 50,000 جنيه';

  @override
  String get q_opt_car_income_b4 => 'أكثر من 50,000 جنيه';

  @override
  String get q_car_q_salary_transfer => 'هل يتم تحويل راتبك إلى حساب بنكي؟';

  @override
  String get q_car_q_employer_approved => 'هل جهة عملك معتمدة لدى البنوك؟';

  @override
  String get q_opt_car_emp_yes => 'نعم';

  @override
  String get q_opt_car_emp_no => 'لا';

  @override
  String get q_opt_car_emp_unsure => 'غير متأكد';

  @override
  String get q_car_q_current_loans => 'هل لديك التزامات أو قروض حالية؟';

  @override
  String get q_car_installments_label => 'القسط الشهري';

  @override
  String get q_car_installments_hint => 'قيمة القسط الشهري';

  @override
  String get q_car_q_credit_card => 'هل لديك بطاقات ائتمان نشطة؟';

  @override
  String get q_car_q_priority => 'أهم أولوية عند اختيار تمويل السيارة؟';

  @override
  String get q_opt_priority_lowest_interest => 'أقل سعر فائدة';

  @override
  String get q_opt_priority_no_guarantor => 'تمويل بدون ضامن';

  @override
  String get q_car_q_insurance => 'هل ترغب في عروض تأمين السيارة؟';

  @override
  String get q_personal_subtitle => 'سنطابقك مع البنوك المتخصصة في احتياجاتك';

  @override
  String get q_personal_next => 'التالي';

  @override
  String get q_personal_finish => 'إنهاء';

  @override
  String get q_personal_submitted => 'تم حفظ إجاباتك';

  @override
  String get q_personal_select_hint => 'اختر';

  @override
  String get q_dyn_subtitle => 'سنطابقك مع البنوك المتخصصة في احتياجاتك';

  @override
  String get q_dyn_select_hint => 'اختر';

  @override
  String get q_dyn_next => 'التالي';

  @override
  String get q_dyn_finish => 'إنهاء';

  @override
  String get q_dyn_error_title => 'حدث خطأ ما';

  @override
  String get q_dyn_error_message => 'تعذّر تحميل الاستبيان. يرجى المحاولة مرة أخرى.';

  @override
  String get q_dyn_retry => 'إعادة المحاولة';

  @override
  String get q_dyn_empty => 'لا توجد أسئلة متاحة حالياً.';

  @override
  String get q_dyn_select_many_hint => 'اختر واحداً أو أكثر';

  @override
  String get q_dyn_text_hint => 'اكتب إجابتك';

  @override
  String get q_dyn_number_hint => 'أدخل رقماً';

  @override
  String get q_dyn_number_invalid => 'أدخل رقماً صحيحاً.';

  @override
  String q_dyn_number_range(String min, String max) {
    return 'أدخل قيمة بين $min و $max.';
  }

  @override
  String q_dyn_number_min(String min) {
    return 'أدخل $min أو أكثر.';
  }

  @override
  String q_dyn_number_max(String max) {
    return 'أدخل $max أو أقل.';
  }

  @override
  String q_dyn_number_step(String step) {
    return 'أدخل قيمة بمضاعفات $step.';
  }

  @override
  String q_dyn_number_step_nearest(String step, String lower, String upper) {
    return 'القيم تتزايد بمقدار $step — أقرب قيمة صحيحة $lower أو $upper.';
  }

  @override
  String q_dyn_number_step_nearest_one(String step, String value) {
    return 'القيم تتزايد بمقدار $step — أقرب قيمة صحيحة $value.';
  }

  @override
  String q_dyn_number_step_helper(String step) {
    return 'بمضاعفات $step';
  }

  @override
  String get q_dyn_obligations_total_helper => 'محسوب من الأقساط التي أدخلتها أعلاه.';

  @override
  String get q_dyn_money_missing => 'أدخل المبلغ ومدة السداد والدخل والأقساط الحالية لعرض العروض المتاحة.';

  @override
  String q_personal_years(Object years) {
    return '$years سنة';
  }

  @override
  String get q_personal_step1_title => 'بيانات التمويل';

  @override
  String get q_personal_step2_title => 'العمل والدخل';

  @override
  String get q_personal_step3_title => 'الالتزامات البنكية';

  @override
  String get q_personal_step4_title => 'التفضيلات والمؤهلات';

  @override
  String get q_personal_q_amount => 'ما المبلغ التقريبي الذي تحتاجه؟';

  @override
  String get q_personal_amount_label => 'قيمة القرض';

  @override
  String get q_personal_amount_hint => 'المبلغ التقريبي الذي تحتاجه';

  @override
  String get q_personal_q_repayment => 'ما مدة السداد المناسبة لك؟';

  @override
  String get q_personal_repayment_label => 'مدة السداد';

  @override
  String get q_personal_q_purpose => 'ما الغرض من القرض؟';

  @override
  String get q_personal_hint_purpose => 'الغرض من القرض';

  @override
  String get q_opt_personal_purpose_home_finishing => 'تشطيب / تجديد المنزل';

  @override
  String get q_opt_personal_purpose_marriage => 'زواج';

  @override
  String get q_opt_personal_purpose_appliances => 'شراء أجهزة أو أثاث';

  @override
  String get q_opt_personal_purpose_education => 'تعليم';

  @override
  String get q_opt_personal_purpose_debt_consolidation => 'سداد ديون';

  @override
  String get q_opt_personal_purpose_personal_project => 'مشروع شخصي';

  @override
  String get q_opt_personal_purpose_other => 'أخرى';

  @override
  String get q_personal_q_employment => 'ما هي حالتك الوظيفية؟';

  @override
  String get q_personal_q_job_tenure => 'منذ متى وأنت في وظيفتك الحالية؟';

  @override
  String get q_personal_hint_job_tenure => 'الوظيفة الحالية';

  @override
  String get q_opt_personal_tenure_under6m => 'أقل من 6 أشهر';

  @override
  String get q_opt_personal_tenure_6m_1y => '6 أشهر – سنة';

  @override
  String get q_opt_personal_tenure_1_3y => '1 – 3 سنوات';

  @override
  String get q_opt_personal_tenure_over3y => 'أكثر من 3 سنوات';

  @override
  String get q_personal_q_income => 'ما متوسط دخلك الشهري؟';

  @override
  String get q_opt_personal_income_b1 => 'بدءًا من 10,000 جنيه';

  @override
  String get q_opt_personal_income_b2 => '10,000 – 20,000 جنيه';

  @override
  String get q_opt_personal_income_b3 => '20,000 – 50,000 جنيه';

  @override
  String get q_opt_personal_income_b4 => '50,000 – 80,000 جنيه';

  @override
  String get q_opt_personal_income_b5 => 'أكثر من 100,000 جنيه';

  @override
  String get q_personal_q_salary_transfer => 'هل يتم تحويل راتبك إلى حساب بنكي؟';

  @override
  String get q_personal_q_employer_approved => 'هل جهة عملك معتمدة لدى البنوك؟';

  @override
  String get q_opt_personal_emp_yes => 'نعم';

  @override
  String get q_opt_personal_emp_no => 'لا';

  @override
  String get q_opt_personal_emp_unsure => 'غير متأكد';

  @override
  String get q_personal_q_obligations => 'هل لديك حاليًا أي قروض أو التزامات مالية؟';

  @override
  String get q_personal_hint_obligations => 'قروض أو التزامات مالية';

  @override
  String get q_opt_personal_obligation_none => 'لا يوجد';

  @override
  String get q_opt_personal_obligation_personal_loan => 'قرض شخصي';

  @override
  String get q_opt_personal_obligation_car_loan => 'قرض سيارة';

  @override
  String get q_opt_personal_obligation_mortgage => 'تمويل عقاري';

  @override
  String get q_opt_personal_obligation_credit_cards => 'بطاقات ائتمان';

  @override
  String get q_opt_personal_obligation_other => 'أخرى';

  @override
  String get q_personal_q_installment => 'ما إجمالي قيمة قسطك الشهري التقريبي؟';

  @override
  String get q_personal_installment_label => 'القسط الشهري';

  @override
  String get q_personal_installment_hint => 'القسط الشهري';

  @override
  String get q_personal_q_credit_card => 'هل لديك بطاقة ائتمان؟';

  @override
  String get q_personal_q_credit_card_usage => 'إذا نعم، ما متوسط استخدامك الشهري لبطاقة الائتمان؟';

  @override
  String get q_opt_personal_cc_usage_b1 => 'أقل من 10,000 جنيه';

  @override
  String get q_opt_personal_cc_usage_b2 => '10,000 – 30,000 جنيه';

  @override
  String get q_opt_personal_cc_usage_b3 => '30,000 – 50,000 جنيه';

  @override
  String get q_opt_personal_cc_usage_b4 => 'أكثر من 50,000 جنيه';

  @override
  String get q_personal_q_priority => 'ما العامل الأهم عند اختيار التمويل؟';

  @override
  String get q_opt_personal_priority_lowest_installment => 'أقل قسط شهري';

  @override
  String get q_opt_personal_priority_lowest_interest => 'أقل سعر فائدة';

  @override
  String get q_opt_personal_priority_minimum_docs => 'أقل مستندات مطلوبة';

  @override
  String get q_opt_personal_priority_flexible_repayment => 'سداد مرن';

  @override
  String get q_personal_q_prior_rejection => 'هل سبق ورُفض لك طلب تمويل؟';

  @override
  String get q_personal_q_assistance => 'هل تحتاج إلى مساعدة في تجهيز المستندات وإتمام الإجراءات؟';

  @override
  String get profile_title => 'الملف الشخصي';

  @override
  String get profile_section_personal => 'المعلومات الشخصية';

  @override
  String get profile_section_contact => 'بيانات التواصل';

  @override
  String get profile_edit => 'تعديل';

  @override
  String get profile_first_name => 'الاسم الأول';

  @override
  String get profile_last_name => 'اسم العائلة';

  @override
  String get profile_password => 'كلمة المرور';

  @override
  String profile_password_changed(int count) {
    return 'آخر تغيير منذ $count أشهر';
  }

  @override
  String get profile_password_hint => 'كلمة مرور جديدة';

  @override
  String get profile_dob => 'تاريخ الميلاد';

  @override
  String get profile_dob_day => 'اليوم';

  @override
  String get profile_dob_month => 'الشهر';

  @override
  String get profile_dob_year => 'السنة';

  @override
  String get profile_dob_hint => 'اختر تاريخ الميلاد';

  @override
  String get profile_national_id => 'الرقم القومي';

  @override
  String get profile_national_id_hint => '— مطلوب لأهلية القرض';

  @override
  String get profile_id_front => 'الوجه الأمامي';

  @override
  String get profile_id_back => 'الوجه الخلفي';

  @override
  String get profile_id_uploaded => 'تم الرفع';

  @override
  String get profile_id_tap_to_upload => 'اضغط للرفع';

  @override
  String get profile_id_uploading => 'جارٍ الرفع…';

  @override
  String get profile_id_checking => 'جارٍ التحقق…';

  @override
  String get profile_id_check_failed => 'تعذّر التحقق';

  @override
  String get profile_id_unavailable => 'اضغط لإعادة الرفع';

  @override
  String get profile_id_upload_failed => 'تعذّر رفع البطاقة. حاول مرة أخرى.';

  @override
  String get profile_save_failed => 'تعذّر حفظ الملف الشخصي. حاول مرة أخرى.';

  @override
  String get profile_save_success => 'تم تحديث ملفك الشخصي.';

  @override
  String get profile_email_taken => 'هذا البريد الإلكتروني مستخدم بالفعل في حساب آخر.';

  @override
  String get profile_dob_locked => 'لا يمكن تغيير تاريخ الميلاد بعد ضبطه.';

  @override
  String get profile_phone_readonly => 'لا يمكن تغيير رقم هاتفك.';

  @override
  String get profile_phone => 'الهاتف';

  @override
  String get profile_phone_hint => 'رقم الهاتف';

  @override
  String get profile_email => 'البريد الإلكتروني';

  @override
  String get profile_address => 'العنوان';

  @override
  String get profile_governorate => 'المحافظة';

  @override
  String get profile_city => 'المدينة';

  @override
  String get profile_save => 'حفظ';

  @override
  String get profile_cancel => 'إلغاء';

  @override
  String get profile_search_hint => 'بحث';

  @override
  String get results_title => 'أفضل العروض المطابقة جاهزة';

  @override
  String get results_subtitle => 'مستشار القروض جاهز';

  @override
  String get results_empty_title => 'لا توجد عروض بعد';

  @override
  String get results_empty_body => 'لم نتمكن من العثور على برامج مطابقة لإجاباتك الآن.';

  @override
  String get results_profile_title => 'أكمل ملفك الشخصي';

  @override
  String get results_profile_body => 'أكمل ملفك الشخصي لعرض عروض القروض.';

  @override
  String get results_profile_action => 'إكمال الملف الشخصي';

  @override
  String get results_loan_type => 'نوع القرض';

  @override
  String get results_program => 'البرنامج';

  @override
  String get results_amount => 'المبلغ';

  @override
  String get results_requested => 'المبلغ المطلوب';

  @override
  String get results_requested_duration => 'المدة المطلوبة';

  @override
  String get results_approved_amount => 'المبلغ المعتمد';

  @override
  String results_amount_egp(String amount) {
    return '$amount ج.م';
  }

  @override
  String get results_duration => 'مدة القرض';

  @override
  String results_months(int count) {
    return '$count شهرًا';
  }

  @override
  String results_guarantee_approval(int pct) {
    return 'توافق $pct%';
  }

  @override
  String get results_unrated => 'لم يُقيَّم بعد';

  @override
  String get results_unavailable_section => 'غير متاح لك حاليًا';

  @override
  String get results_unavailable_badge => 'لا يوجد عرض من هذا البنك';

  @override
  String get results_unavailable_generic => 'تعذّر على هذا البنك تقديم عرض لك حاليًا.';

  @override
  String results_unavailable_ceiling(String amount) {
    return 'يمكنك الاقتراض حتى $amount جنيه من هذا البنك.';
  }

  @override
  String get results_best_match => 'أفضل تطابق';

  @override
  String get results_rate => 'الفائدة';

  @override
  String get results_monthly => 'شهريًا';

  @override
  String get results_total => 'الإجمالي';

  @override
  String get results_view_offer => 'عرض العرض';

  @override
  String get results_max_borrow => 'تقدر تقترض حتى';

  @override
  String results_max_borrow_value(String amount) {
    return '$amount جنيه';
  }

  @override
  String get offer_type_personal => 'شخصي';

  @override
  String get offer_type_car => 'سيارة';

  @override
  String get offer_type_mortgage => 'عقاري';

  @override
  String get offer_type_business => 'أعمال';

  @override
  String offer_title(String type) {
    return 'قرض $type';
  }

  @override
  String offer_approval(int pct) {
    return 'درجة التوافق $pct%';
  }

  @override
  String get offer_unrated => 'لم يُقيَّم بعد';

  @override
  String get offer_interest_rate => 'سعر الفائدة';

  @override
  String get offer_fixed_apr => 'فائدة ثابتة';

  @override
  String get offer_monthly => 'شهريًا';

  @override
  String get offer_egp_month => 'ج.م / شهر';

  @override
  String get offer_duration => 'المدة';

  @override
  String get offer_months => 'أشهر';

  @override
  String get offer_total_interest => 'إجمالي الفائدة';

  @override
  String get offer_total_interest_caption => 'فائدة على مدة القرض';

  @override
  String get offer_cash_received => 'المبلغ اللي هتستلمه';

  @override
  String get offer_cash_received_caption => 'بعد خصم الرسوم';

  @override
  String get offer_egp_extra => 'ج.م إضافية';

  @override
  String get offer_national_id => 'الرقم القومي';

  @override
  String get offer_national_id_pending => 'قيد الانتظار';

  @override
  String get offer_national_id_uploaded => 'تم الرفع';

  @override
  String get offer_personal_id => 'إثبات الهوية';

  @override
  String get offer_total_loan => 'إجمالي القرض';

  @override
  String get offer_total_loan_caption => 'شامل الفائدة + الأصل';

  @override
  String get offer_max_borrow => 'أقصى مبلغ تقدر تقترضه';

  @override
  String offer_max_borrow_caption(String pct) {
    return 'بحد أقصى $pct% لنسبة الالتزامات';
  }

  @override
  String get offer_dbr => 'نسبة الالتزامات';

  @override
  String get offer_dbr_caption => 'من دخلك الشهري';

  @override
  String get offer_headroom_hint => 'طلبت أقل من المبلغ اللي تقدر تاخده.';

  @override
  String get offer_fees_title => 'الرسوم والمصاريف';

  @override
  String get offer_admin_fees => 'رسوم إدارية';

  @override
  String get offer_admin_fees_value => '1% (1,500 ج.م)';

  @override
  String get offer_interest_charge => '12% - 15% من أصل المبلغ';

  @override
  String get offer_interest_charge_value => '12.5% سنويًا';

  @override
  String offer_interest_charge_value_rate(String pct) {
    return '$pct% سنويًا';
  }

  @override
  String get offer_stamp_duty => 'الدمغة';

  @override
  String get offer_life_insurance => 'تأمين الحياة';

  @override
  String offer_fee_egp(String amount) {
    return '$amount جنيه';
  }

  @override
  String get offer_early_settlement => 'السداد المبكر';

  @override
  String get offer_early_settlement_value => 'مجاني بعد 12 شهرًا';

  @override
  String get offer_apply => 'تقدم بطلب لهذا العرض';

  @override
  String get offer_save_later => 'احفظ العرض لاحقًا';

  @override
  String get offer_action_soon => 'قريبًا';

  @override
  String get offer_proceed_success => 'تم إرسال طلبك إلى البنك.';

  @override
  String get offer_proceed_error => 'حدث خطأ ما. حاول مرة أخرى.';

  @override
  String get offer_national_id_required_title => 'الرقم القومي مطلوب';

  @override
  String get offer_national_id_required_body => 'قم برفع صورة الرقم القومي من الأمام والخلف للمتابعة في هذا الطلب.';

  @override
  String get offer_national_id_required_cta => 'ارفع الآن';

  @override
  String get apply_docs_title => 'أكمل مستنداتك';

  @override
  String get apply_docs_subtitle => 'أضف صورتك والرقم القومي لإرسال هذا الطلب إلى البنك.';

  @override
  String get apply_docs_photo_section => 'الصورة الشخصية';

  @override
  String get apply_docs_photo_hint => 'مطلوبة';

  @override
  String get apply_docs_cta => 'متابعة الطلب';

  @override
  String get apply_docs_upload_error => 'تعذّر رفع الملف. حاول مرة أخرى.';

  @override
  String get auth_profile_photo_required => 'ارفع صورتك الشخصية قبل التقديم على القرض.';

  @override
  String get offer_save_success => 'تم حفظ العرض. يمكنك إيجاده في العروض المحفوظة.';

  @override
  String get offer_save_error => 'لم نتمكن من حفظ هذا العرض. حاول مرة أخرى.';

  @override
  String get offer_saved => 'تم الحفظ';

  @override
  String get offer_removed_success => 'تمت الإزالة من المحفوظات.';

  @override
  String get offer_remove_error => 'لم نتمكن من إزالة هذا العرض. حاول مرة أخرى.';

  @override
  String get settings_security_title => 'الإعدادات والأمان';

  @override
  String get settings_section_privacy_security => 'الخصوصية والأمان';

  @override
  String get settings_biometric_title => 'تسجيل الدخول بالبصمة';

  @override
  String get settings_biometric_subtitle => 'بصمة الوجه / بصمة الإصبع';

  @override
  String get settings_biometric_confirm_reason => 'أكّد ببصمة الوجه أو الإصبع لتفعيل تسجيل الدخول بالبصمة';

  @override
  String get settings_biometric_unavailable => 'تسجيل الدخول بالبصمة غير مُعد على هذا الجهاز بعد';

  @override
  String get biometric_lock_title => 'افتح تطبيق مصرفي ببصمة الوجه أو الإصبع';

  @override
  String get biometric_lock_reason => 'فتح تطبيق مصرفي';

  @override
  String get biometric_lock_retry => 'حاول مرة أخرى';

  @override
  String get biometric_lock_logout => 'تسجيل الخروج';

  @override
  String get settings_privacy_policies_title => 'سياسات الخصوصية';

  @override
  String get settings_privacy_policies_subtitle => 'سياسات الخصوصية - الشروط والأحكام';

  @override
  String get settings_section_notification_center => 'مركز الإشعارات';

  @override
  String get settings_notifications_title => 'تفعيل الإشعارات';

  @override
  String get settings_notifications_subtitle => 'استقبال الإشعارات';

  @override
  String get settings_section_languages => 'اللغات';

  @override
  String get settings_change_language_title => 'تغيير اللغة';

  @override
  String get settings_language_sheet_title => 'تغيير اللغة';

  @override
  String get settings_language_english => 'الإنجليزية';

  @override
  String get settings_language_arabic => 'العربية';

  @override
  String get settings_change_password_title => 'تغيير كلمة المرور';

  @override
  String get settings_change_password_subtitle => 'تحديث كلمة مرور حسابك';

  @override
  String get change_password_title => 'تغيير كلمة المرور';

  @override
  String get change_password_hint => 'أدخل كلمة المرور الحالية، ثم اختر كلمة مرور جديدة لا تقل عن ١٢ حرفًا وتحتوي على حرف كبير وحرف صغير ورقم ورمز.';

  @override
  String get change_password_current_label => 'كلمة المرور الحالية';

  @override
  String get change_password_current_hint => 'أدخل كلمة المرور الحالية';

  @override
  String get change_password_new_label => 'كلمة المرور الجديدة';

  @override
  String get change_password_new_hint => 'أدخل كلمة المرور الجديدة';

  @override
  String get change_password_confirm_label => 'تأكيد كلمة المرور الجديدة';

  @override
  String get change_password_confirm_hint => 'أعد إدخال كلمة المرور الجديدة';

  @override
  String get change_password_action => 'حفظ';

  @override
  String get change_password_success => 'تم تغيير كلمة المرور. الرجاء تسجيل الدخول بكلمة المرور الجديدة.';

  @override
  String get change_password_error_current_incorrect => 'كلمة المرور الحالية غير صحيحة.';

  @override
  String get change_password_error_same_as_old => 'يجب أن تختلف كلمة المرور الجديدة عن الحالية.';

  @override
  String get change_password_error_social_forbidden => 'تغيير كلمة المرور غير متاح لحسابات تسجيل الدخول عبر مواقع التواصل.';

  @override
  String get change_password_error_policy => 'يجب أن تتكون كلمة المرور من ١٢ حرفًا على الأقل وتشمل حرفًا كبيرًا وصغيرًا ورقمًا ورمزًا.';

  @override
  String get change_password_error_breached => 'ظهرت كلمة المرور هذه في تسريب بيانات معروف. يرجى اختيار كلمة مرور مختلفة.';

  @override
  String get change_password_error_common => 'كلمة المرور هذه شائعة جدًا. يرجى اختيار كلمة مرور أقوى.';

  @override
  String get change_password_error_breach_check_unavailable => 'تعذر التحقق من كلمة المرور الآن. يرجى المحاولة بعد قليل.';

  @override
  String get change_password_error_account_inactive => 'حسابك غير نشط. يرجى التواصل مع الدعم.';

  @override
  String get change_password_error_mismatch => 'كلمتا المرور غير متطابقتين';

  @override
  String get forgot_password_phone_title => 'إعادة تعيين كلمة المرور';

  @override
  String get forgot_password_phone_subtitle => 'أدخل رقم هاتفك وسنرسل لك رمز تحقق.';

  @override
  String get forgot_password_phone_hint => 'سنرسل رمزًا من 6 أرقام إلى هاتفك للتأكد من هويتك.';

  @override
  String get forgot_password_send_cta => 'إرسال الرمز';

  @override
  String get forgot_password_otp_title => 'تحقق من رقم هاتفك';

  @override
  String get forgot_password_new_title => 'اختر كلمة مرور جديدة';

  @override
  String get forgot_password_new_subtitle => 'اختر كلمة مرور قوية جديدة لحسابك.';

  @override
  String get forgot_password_new_hint => 'اختر كلمة مرور جديدة لا تقل عن 12 حرفًا وتشمل حروفًا كبيرة وصغيرة ورقمًا ورمزًا.';

  @override
  String get forgot_password_reset_cta => 'إعادة تعيين كلمة المرور';

  @override
  String get forgot_password_success => 'تم إعادة تعيين كلمة المرور. الرجاء تسجيل الدخول بكلمة المرور الجديدة.';

  @override
  String get forgot_password_error_unavailable => 'تعذّر إعادة تعيين كلمة المرور لهذا الرقم. حاول مرة أخرى أو تواصل مع الدعم.';

  @override
  String get photo_source_title => 'صورة الملف الشخصي';

  @override
  String get photo_source_camera => 'التقاط صورة';

  @override
  String get photo_source_gallery => 'اختيار من المعرض';

  @override
  String get profile_photo_upload_failed => 'تعذّر رفع الصورة. حاول مرة أخرى.';

  @override
  String get error_answer_type_mismatch => 'هذه الإجابة لا تطابق نوع السؤال.';

  @override
  String get error_answer_out_of_range => 'هذا الرقم خارج النطاق المسموح.';

  @override
  String get error_answer_too_long => 'هذه الإجابة أطول من المسموح.';

  @override
  String get error_answer_required => 'من فضلك أجب على هذا السؤال.';

  @override
  String get error_money_figure_missing => 'تنقص قيمة لازمة للتقدير. من فضلك راجع إجاباتك.';

  @override
  String get error_calculator_input_invalid => 'من فضلك تحقق من المبلغ والمدة والدخل والأقساط الحالية.';

  @override
  String get error_calculator_program_inactive => 'هذا البرنامج غير متاح حاليًا.';

  @override
  String get error_obligations_total_mismatch => 'إجمالي أقساطك الشهرية غير مطابق. من فضلك راجع التزاماتك وحاول مرة أخرى.';

  @override
  String get reason_no_recognised_income => 'تعذّر الاعتراف بدخل شهري لهذا البرنامج.';

  @override
  String get reason_obligations_exceed_allowance => 'أقساطك الشهرية الحالية تستهلك الحد المسموح بالكامل.';

  @override
  String get reason_below_program_min_amount => 'المبلغ الممكن تحمله أقل من الحد الأدنى لهذا البرنامج.';

  @override
  String get reason_age_at_maturity => 'لا توجد مدة متاحة تُبقيك داخل حد السن لهذا البرنامج.';

  @override
  String get reason_currency_not_offered => 'هذا البرنامج لا يوفر العملة المطلوبة.';

  @override
  String get reason_program_misconfigured => 'لا يمكن تسعير هذا البرنامج حاليًا.';

  @override
  String get disclaimer_indicative_estimate => 'تقدير استرشادي وليس عرضًا ملزمًا. الأرقام النهائية تصدر من البنك.';

  @override
  String get id_capture_title_front => 'الوجه الأمامي للبطاقة';

  @override
  String get id_capture_title_back => 'الوجه الخلفي للبطاقة';

  @override
  String get id_capture_hint => 'ضع بطاقة الرقم القومي داخل الإطار ثم اضغط زر التصوير.';

  @override
  String get id_capture_retry => 'حاول مرة أخرى';

  @override
  String get id_capture_close => 'إغلاق الكاميرا';

  @override
  String get id_capture_shutter => 'التقاط';

  @override
  String get id_capture_torch_on => 'تشغيل الإضاءة';

  @override
  String get id_capture_torch_off => 'إطفاء الإضاءة';

  @override
  String get id_capture_error => 'تعذّر تشغيل الكاميرا على هذا الجهاز.';

  @override
  String get id_capture_permission_error => 'إذن الكاميرا غير مفعّل. فعّل الكاميرا لتطبيق مصرفي من إعدادات جهازك ثم حاول مرة أخرى.';

  @override
  String get id_capture_capture_error => 'تعذّر حفظ هذه الصورة. من فضلك أعد التصوير.';
}
