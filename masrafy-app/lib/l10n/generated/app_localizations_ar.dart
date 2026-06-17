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
  String get error_invalid_credentials => 'رقم الهاتف أو كلمة المرور غير صحيحة.';

  @override
  String get error_network => 'لا يوجد اتصال. تحقق من الشبكة وحاول مجددًا.';

  @override
  String get error_generic => 'حدث خطأ ما. حاول مرة أخرى.';

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
  String get onboarding_apple => 'Apple';

  @override
  String get onboarding_lang_toggle => 'English';

  @override
  String get login_title => 'سجّل الدخول إلى حسابك';

  @override
  String get login_subtitle => 'سجّل الدخول لاكتشاف أفضل عروض القروض';

  @override
  String get login_identifier_label => 'البريد أو الهاتف';

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
  String get login_apple => 'Apple';

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
  String get signup_first_name_label => 'الاسم الأول';

  @override
  String get signup_first_name_hint => 'محمد';

  @override
  String get signup_last_name_label => 'اسم العائلة';

  @override
  String get signup_last_name_hint => 'إسكندر';

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
  String get signup_national_id_hint => '— مطلوب للأهلية للحصول على القرض';

  @override
  String get signup_id_front => 'الوجه الأمامي';

  @override
  String get signup_id_back => 'الوجه الخلفي';

  @override
  String get signup_id_tap_to_upload => 'اضغط للرفع';

  @override
  String get signup_terms => 'أوافق على شروط الخدمة وسياسة الخصوصية الخاصة بمصرفي، وأوافق على معالجة بياناتي المالية.';

  @override
  String get signup_cta => 'إنشاء الحساب';

  @override
  String get signup_have_account => 'لديك حساب بالفعل؟';

  @override
  String get signup_sign_in => 'تسجيل الدخول';

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
  String get home_continue => 'متابعة';

  @override
  String get home_support_label => 'الدعم';

  @override
  String get home_support_title => 'اسأل مصرفي عن أي شيء';

  @override
  String get home_nav_loans => 'قروضي';

  @override
  String get home_nav_profile => 'حسابي';

  @override
  String get home_cat_personal => 'شخصي';

  @override
  String get home_cat_mortgage => 'عقاري';

  @override
  String get home_cat_car => 'سيارة';

  @override
  String get home_cat_business => 'أعمال';

  @override
  String get home_limit_personal => 'حتى ٢٠٠ ألف ج.م';

  @override
  String get home_limit_mortgage => 'حتى ٣ مليون ج.م';

  @override
  String get home_limit_car => 'حتى ٢ مليون ج.م';

  @override
  String get home_limit_business => 'حتى ٥ مليون ج.م';

  @override
  String get home_apr_personal => 'من ١١٪ سنويًا';

  @override
  String get home_apr_mortgage => 'من ٩٫٥٪ سنويًا';

  @override
  String get home_apr_car => 'من ١٠٫٢٪ سنويًا';

  @override
  String get home_apr_business => 'من ١٢٪ سنويًا';

  @override
  String get q_common_yes => 'نعم';

  @override
  String get q_common_no => 'لا';

  @override
  String get q_common_currency_egp => 'ج.م';

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
}
