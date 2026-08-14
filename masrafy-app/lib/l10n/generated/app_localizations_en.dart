import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get auth_otp_invalid => 'Incorrect code. Please try again.';

  @override
  String get auth_otp_expired => 'This code expired. Request a new one.';

  @override
  String get auth_otp_consumed => 'This code has already been used.';

  @override
  String get auth_otp_attempts_exceeded => 'Too many wrong attempts. Request a new code.';

  @override
  String get auth_otp_rate_limited => 'Too many code requests. Please wait and try again.';

  @override
  String get auth_otp_purpose_login_forbidden => 'Login does not require an SMS code. Use your password.';

  @override
  String get auth_phone_already_registered => 'This number is already registered. Please log in instead.';

  @override
  String get auth_verified_mobile_token_invalid => 'Verification token is invalid. Restart the signup.';

  @override
  String get auth_verified_mobile_token_expired => 'Verification token expired. Restart the signup.';

  @override
  String get auth_verified_mobile_token_consumed => 'Verification token was already used.';

  @override
  String get auth_social_token_invalid => 'Sign-in failed. Please try again.';

  @override
  String get auth_social_token_expired => 'Sign-in session expired. Please try again.';

  @override
  String get auth_social_provider_unavailable => 'The sign-in provider is temporarily unavailable.';

  @override
  String get auth_social_session_invalid => 'Sign-in session is invalid.';

  @override
  String get auth_social_session_expired => 'Sign-in session expired. Tap the provider button again.';

  @override
  String get auth_social_session_consumed => 'Sign-in session was already used.';

  @override
  String get auth_account_locked => 'Account temporarily locked after too many failed attempts. Try again later.';

  @override
  String get auth_password_not_set => 'This account has no password. Sign in with Google.';

  @override
  String get auth_password_same_as_old => 'Pick a new password different from the current one.';

  @override
  String get auth_profile_incomplete => 'Complete your profile to continue.';

  @override
  String get auth_profile_field_immutable => 'This field cannot be changed once set.';

  @override
  String get auth_profile_id_docs_missing => 'Upload both National ID front and back before completing your profile.';

  @override
  String get auth_national_id_required => 'Upload your National ID (front and back) before applying for a loan.';

  @override
  String get auth_password_required_for_phone_profile => 'A password is required to complete your profile.';

  @override
  String get auth_password_forbidden_for_social_profile => 'Accounts using Google sign-in do not set a password.';

  @override
  String get auth_phone_mutation_on_phone_customer_forbidden => 'Mobile number is already set on this account.';

  @override
  String get auth_password_change_forbidden_for_social => 'Password change is not available for accounts using Google sign-in.';

  @override
  String get auth_age_invalid => 'Age must be between 18 and 80.';

  @override
  String get auth_documents_missing => 'Both National ID front and back are required.';

  @override
  String get auth_documents_not_owned => 'These documents are not associated with your account.';

  @override
  String get auth_bank_program_invalid => 'This offer is no longer available for your profile.';

  @override
  String get auth_landing_brand => 'Masrafy';

  @override
  String get auth_landing_action_phone_signup => 'Sign Up with Phone';

  @override
  String get auth_landing_action_google => 'Continue with Google';

  @override
  String get auth_landing_action_login => 'Log In';

  @override
  String get auth_login_title => 'Log in';

  @override
  String get auth_login_field_mobile => 'Mobile number';

  @override
  String get auth_login_field_password => 'Password';

  @override
  String get auth_login_action_submit => 'Log in';

  @override
  String get auth_login_action_forgot => 'Forgot password?';

  @override
  String get auth_forgot_password_title_request => 'Forgot password';

  @override
  String get auth_forgot_password_title_verify => 'Verify code';

  @override
  String get auth_forgot_password_title_reset => 'New password';

  @override
  String get auth_forgot_password_field_mobile => 'Mobile number';

  @override
  String get auth_forgot_password_field_otp => '6-digit code';

  @override
  String get auth_forgot_password_field_new_password => 'New password';

  @override
  String get auth_forgot_password_field_confirm_password => 'Confirm new password';

  @override
  String get auth_forgot_password_action_send => 'Send code';

  @override
  String get auth_forgot_password_action_verify => 'Verify';

  @override
  String get auth_forgot_password_action_reset => 'Reset password';

  @override
  String get auth_forgot_password_validation_password_min => 'min 8 chars';

  @override
  String get auth_forgot_password_validation_password_letter => 'need a letter';

  @override
  String get auth_forgot_password_validation_password_digit => 'need a digit';

  @override
  String get auth_forgot_password_validation_password_mismatch => 'does not match';

  @override
  String get auth_phone_signup_title_phone => 'Sign up — Mobile';

  @override
  String get auth_phone_signup_title_verify => 'Verify code';

  @override
  String get auth_phone_signup_title_details => 'Your details';

  @override
  String get auth_phone_signup_field_mobile => 'Mobile number';

  @override
  String get auth_phone_signup_field_mobile_hint => '01001234567';

  @override
  String get auth_phone_signup_field_otp => '6-digit code';

  @override
  String get auth_phone_signup_field_name => 'Full name';

  @override
  String get auth_phone_signup_field_email => 'Email';

  @override
  String get auth_phone_signup_field_password => 'Password';

  @override
  String get auth_phone_signup_field_password_confirm => 'Confirm password';

  @override
  String get auth_phone_signup_field_age => 'Age';

  @override
  String get auth_phone_signup_action_send => 'Send code';

  @override
  String get auth_phone_signup_action_verify => 'Verify';

  @override
  String get auth_phone_signup_action_create => 'Create account';

  @override
  String get auth_phone_signup_validation_required => 'required';

  @override
  String get auth_phone_signup_validation_email_invalid => 'invalid';

  @override
  String get auth_phone_signup_validation_password_min => 'min 8 chars';

  @override
  String get auth_phone_signup_validation_password_letter => 'need a letter';

  @override
  String get auth_phone_signup_validation_password_digit => 'need a digit';

  @override
  String get auth_phone_signup_validation_password_mismatch => 'does not match';

  @override
  String get auth_phone_signup_validation_age_range => '18–80';

  @override
  String get auth_complete_profile_title => 'Complete your profile';

  @override
  String get auth_complete_profile_body => 'We need a few more details before you can apply. This is required by the bank.';

  @override
  String get auth_complete_profile_action_cancel => 'Cancel';

  @override
  String get auth_complete_profile_action_complete => 'Complete Profile';

  @override
  String get auth_complete_profile_title_mobile => 'Complete profile — mobile';

  @override
  String get auth_complete_profile_title_verify => 'Verify code';

  @override
  String get auth_complete_profile_title_email => 'Email';

  @override
  String get auth_complete_profile_title_age => 'Age';

  @override
  String get auth_complete_profile_field_mobile => 'Mobile number';

  @override
  String get auth_complete_profile_field_otp => '6-digit code';

  @override
  String get auth_complete_profile_field_email => 'Email';

  @override
  String get auth_complete_profile_field_age => 'Age (18–80)';

  @override
  String get auth_complete_profile_action_send => 'Send code';

  @override
  String get auth_complete_profile_action_verify => 'Verify';

  @override
  String get auth_complete_profile_action_continue => 'Continue';

  @override
  String get match_questionnaire_not_published => 'This questionnaire is not available yet. Please try again later.';

  @override
  String get match_unknown_question_code => 'Your answers are out of date. Please restart the questionnaire.';

  @override
  String get match_unknown_option_code => 'Your answers are out of date. Please restart the questionnaire.';

  @override
  String get match_program_no_longer_matches => 'This offer is no longer available for your answers.';

  @override
  String get match_program_name_key_unknown => 'That program is no longer available. Please pick another one.';

  @override
  String get match_program_name_not_in_category => 'That program isn\'t offered for this loan type. Please pick another one.';

  @override
  String get questionnaire_form_title => 'Tell us about your loan';

  @override
  String get questionnaire_form_action_submit => 'See matches';

  @override
  String get match_preview_title => 'Your matches';

  @override
  String get match_preview_no_matches => 'No programs match your answers yet. Try adjusting them.';

  @override
  String get match_preview_section_suggestions => 'Ways to unlock more offers';

  @override
  String get match_preview_required_documents => 'Required documents';

  @override
  String get match_preview_rejection_reasons => 'Why this isn\'t eligible';

  @override
  String get match_preview_monthly_installment => 'Monthly installment';

  @override
  String get match_preview_effective_rate => 'Effective rate';

  @override
  String match_preview_suggestion_unlock(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Unlocks $count more programs',
      one: 'Unlocks 1 more program',
      zero: 'Adjusting this answer could help',
    );
    return '$_temp0';
  }

  @override
  String get match_featured_badge => 'Featured';

  @override
  String get match_tier_excellent => 'Excellent chance';

  @override
  String get match_tier_good => 'Good chance';

  @override
  String get match_tier_moderate => 'Moderate chance';

  @override
  String get match_tier_low => 'Low chance';

  @override
  String get match_tier_very_low => 'Very low chance';

  @override
  String get match_tier_unknown => 'Estimated chance';

  @override
  String get match_action_retry => 'Retry';

  @override
  String get match_generic_error => 'Something went wrong. Please try again.';

  @override
  String get match_network_error => 'No connection. Check your network and try again.';

  @override
  String get match_preview_adjust_answers => 'Adjust my answers';

  @override
  String get questionnaire_form_submit_hint => 'Answer all required questions to see your matches.';

  @override
  String match_amount_egp(String value) {
    return '$value EGP';
  }

  @override
  String match_rate_percent(String value) {
    return '$value%';
  }

  @override
  String get common_coming_soon => 'Coming soon';

  @override
  String get common_cancel => 'Cancel';

  @override
  String get error_invalid_credentials => 'Incorrect phone or password.';

  @override
  String get error_network => 'No connection. Check your network and try again.';

  @override
  String get error_generic => 'Something went wrong. Please try again.';

  @override
  String get error_image_too_large => 'This image is too large. Please pick a smaller one.';

  @override
  String get error_rate_limited => 'Too many attempts. Please wait a moment and try again.';

  @override
  String get onboarding_slide1_title => 'Discover tailored loan offers.';

  @override
  String get onboarding_slide1_body => 'We scan multiple top-tier banks to find the best rates and terms specifically for your profile.';

  @override
  String get onboarding_slide2_title => 'Compare offers in seconds.';

  @override
  String get onboarding_slide2_body => 'Personal, car, mortgage and business loans — side by side, with clear rates and limits.';

  @override
  String get onboarding_slide3_title => 'Apply with confidence.';

  @override
  String get onboarding_slide3_body => 'Get matched, then apply to the offer that fits you best. Free for you, always.';

  @override
  String get onboarding_next => 'Next';

  @override
  String get onboarding_skip => 'Skip';

  @override
  String get onboarding_signin => 'Sign in';

  @override
  String get onboarding_or_continue => 'or continue with';

  @override
  String get onboarding_google => 'Google';

  @override
  String get onboarding_lang_toggle => 'العربية';

  @override
  String get login_title => 'Sign in to your Account';

  @override
  String get login_subtitle => 'Sign in to explore your best loan offers';

  @override
  String get login_identifier_label => 'Email';

  @override
  String get login_identifier_hint => 'ahmed@masrafy.io';

  @override
  String get login_password_label => 'Password';

  @override
  String get login_password_hint => 'Enter your password';

  @override
  String get login_forgot => 'Forgot your password?';

  @override
  String get login_cta => 'Sign in';

  @override
  String get login_or_continue => 'or continue with';

  @override
  String get login_google => 'Google';

  @override
  String get login_no_account => 'Don\'t have an account?';

  @override
  String get login_create_account => 'Create account';

  @override
  String get login_terms => 'By signing up, you agree to the Terms of Service';

  @override
  String get signup_title => 'Create your Account';

  @override
  String get signup_subtitle => 'Sign up to explore your best loan offers';

  @override
  String get signup_photo_upload => 'Upload';

  @override
  String get signup_photo_optional => 'Optional';

  @override
  String get signup_first_name_label => 'First name';

  @override
  String get signup_first_name_hint => 'David';

  @override
  String get signup_last_name_label => 'Last name';

  @override
  String get signup_last_name_hint => 'Iskandar';

  @override
  String get signup_phone_code_label => 'Country code';

  @override
  String get signup_phone_label => 'Phone number';

  @override
  String get signup_phone_hint => '101 234 5678';

  @override
  String get signup_email_label => 'Email address';

  @override
  String get signup_email_hint => 'ahmed@example.com';

  @override
  String get signup_dob_label => 'Date of birth';

  @override
  String get signup_dob_day => 'Day';

  @override
  String get signup_dob_month => 'Month';

  @override
  String get signup_dob_year => 'Year';

  @override
  String get signup_dob_hint => 'Select date of birth';

  @override
  String signup_age_verified(Object years) {
    return 'Age verified — $years years old';
  }

  @override
  String get signup_password_label => 'Password';

  @override
  String get signup_password_hint => 'Create a password';

  @override
  String get signup_confirm_password_label => 'Confirm password';

  @override
  String get signup_confirm_password_hint => 'Re-enter password';

  @override
  String get signup_national_id_label => 'National ID';

  @override
  String get signup_national_id_hint => '— optional now, needed when you pick an offer';

  @override
  String get signup_id_front => 'Front side';

  @override
  String get signup_id_back => 'Back side';

  @override
  String get signup_id_tap_to_upload => 'Tap to capture';

  @override
  String get signup_id_captured => 'Captured';

  @override
  String get signup_id_unavailable => 'Tap to upload again';

  @override
  String get signup_id_upload_deferred => 'Your account is ready, but the National ID didn\'t upload. Add it from your profile.';

  @override
  String get signup_terms => 'I agree to Masrafy\'s Terms of Service and Privacy Policy, and consent to processing my financial data.';

  @override
  String get signup_cta => 'Create Account';

  @override
  String get signup_have_account => 'Already have an account?';

  @override
  String get signup_sign_in => 'Sign in';

  @override
  String get phone_verification_title => 'Add your phone number';

  @override
  String get phone_verification_subtitle => 'We need your phone to secure your account. We\'ll send you a verification code.';

  @override
  String get phone_verification_cta => 'Send verification code';

  @override
  String get otp_title => 'Verify your phone number';

  @override
  String otp_subtitle(Object destination) {
    return 'We sent a 6-digit code to $destination. Enter it below.';
  }

  @override
  String get otp_enter_code => 'Enter verification code';

  @override
  String otp_attempts_left(Object count) {
    return '$count attempts left';
  }

  @override
  String get otp_resend_in => 'Resend code in';

  @override
  String get otp_resend_action => 'Resend code';

  @override
  String otp_expiry_notice(Object minutes) {
    return 'This code expires in $minutes minutes. Never share it with anyone — Masrafy will never ask for it.';
  }

  @override
  String get otp_verify_cta => 'Verify & continue';

  @override
  String get otp_didnt_receive => 'DIDN\'T RECEIVE IT?';

  @override
  String get otp_wrong_number => 'Wrong number?';

  @override
  String get otp_change_phone => 'Change phone';

  @override
  String get home_title => 'What type of loan are you looking for?';

  @override
  String get home_subtitle => 'Your loan advisor is ready';

  @override
  String get home_loan_types => 'Loan types';

  @override
  String get home_program_label => 'Loan program';

  @override
  String get home_program_hint => 'Choose a program';

  @override
  String get home_program_search_hint => 'Search programs';

  @override
  String get home_continue => 'Continue';

  @override
  String get home_support_label => 'Support';

  @override
  String get home_support_title => 'Ask Masrafy anything';

  @override
  String get home_nav_loans => 'My Loans';

  @override
  String get home_nav_home => 'Home';

  @override
  String get home_nav_menu => 'Account';

  @override
  String get account_title => 'Account';

  @override
  String get account_row_profile => 'Profile';

  @override
  String get account_row_settings_security => 'Settings & Security';

  @override
  String get account_row_saved_offers => 'Saved Offers';

  @override
  String get account_row_notifications => 'Notifications Center';

  @override
  String get account_row_previous_applications => 'Previous Applications';

  @override
  String get account_row_logout => 'Log out';

  @override
  String get account_logout_confirm_title => 'Sign out of Masrafy?';

  @override
  String get account_logout_confirm_message => 'You\'ll be returned to the login screen.';

  @override
  String get account_logout_confirm_action => 'Sign out';

  @override
  String get account_logout_confirm_cancel => 'Cancel';

  @override
  String get saved_offers_empty_title => 'No saved offers yet';

  @override
  String get saved_offers_empty_body => 'Offers you save will appear here.';

  @override
  String get saved_offers_remove => 'Remove';

  @override
  String get saved_offers_remove_failed => 'Couldn\'t remove the offer. Please try again.';

  @override
  String get error_saved_offer_not_found => 'This offer is not in your saved offers.';

  @override
  String get previous_applications_title => 'Applications';

  @override
  String get previous_applications_empty_title => 'No applications yet';

  @override
  String get previous_applications_empty_body => 'Apply for an offer and it will show up here.';

  @override
  String get previous_applications_status_applied => 'Applied';

  @override
  String get previous_applications_status_approved => 'Approved';

  @override
  String get previous_applications_status_rejected => 'Rejected';

  @override
  String get home_cat_personal => 'Personal';

  @override
  String get home_cat_mortgage => 'Mortgage';

  @override
  String get home_cat_car => 'Car loan';

  @override
  String get home_cat_business => 'Business';

  @override
  String get q_common_yes => 'Yes';

  @override
  String get q_common_no => 'No';

  @override
  String get q_common_currency_egp => 'EGP';

  @override
  String get q_common_save => 'Save';

  @override
  String get q_common_cancel => 'Cancel';

  @override
  String get q_common_search => 'Search';

  @override
  String get q_mortgage_title => 'Mortgage application';

  @override
  String get q_mortgage_subtitle => 'We\'ll match you with banks that specialise in your needs';

  @override
  String get q_mortgage_next => 'Next';

  @override
  String get q_mortgage_finish => 'Finish';

  @override
  String get q_mortgage_submitted => 'Your answers have been saved';

  @override
  String get q_mortgage_step1_title => 'Property & Financing Details';

  @override
  String get q_mortgage_step2_title => 'Employment & Income';

  @override
  String get q_mortgage_step3_title => 'Credit Profile';

  @override
  String get q_mortgage_step4_title => 'Preferences';

  @override
  String get q_mortgage_select_hint => 'Select an option';

  @override
  String q_mortgage_years(Object years) {
    return '$years years';
  }

  @override
  String get q_mortgage_q_property_type => 'What type of property would you like to finance?';

  @override
  String get q_mortgage_hint_property_type => 'Select property type';

  @override
  String get q_opt_property_apartment => 'Apartment';

  @override
  String get q_opt_property_villa => 'Villa';

  @override
  String get q_opt_property_duplex => 'Duplex';

  @override
  String get q_opt_property_commercial => 'Commercial shop';

  @override
  String get q_opt_property_office => 'Administrative office';

  @override
  String get q_opt_property_other => 'Other';

  @override
  String get q_mortgage_q_in_compound => 'Is the property located within a residential compound?';

  @override
  String get q_mortgage_q_registration_status => 'What is the property\'s registration status?';

  @override
  String get q_opt_reg_registered => 'Officially registered';

  @override
  String get q_opt_reg_eligible => 'Eligible for registration';

  @override
  String get q_opt_reg_not_registered => 'Not registered';

  @override
  String get q_opt_reg_unsure => 'Not sure';

  @override
  String get q_mortgage_q_address => 'What is the property address?';

  @override
  String get q_mortgage_hint_governorate => 'Select governorate';

  @override
  String get q_mortgage_address_label => 'Address';

  @override
  String get q_mortgage_address_hint => 'Street, building, area';

  @override
  String get q_mortgage_q_property_value => 'What is the approximate property value?';

  @override
  String get q_mortgage_q_down_payment => 'How much down payment do you currently have? (%)';

  @override
  String get q_mortgage_hint_down_payment => 'Down payment';

  @override
  String get q_opt_dp_under10 => 'Less than 10%';

  @override
  String get q_opt_dp_10_20 => '10% – 20%';

  @override
  String get q_opt_dp_20_30 => '20% – 30%';

  @override
  String get q_opt_dp_over30 => 'More than 30%';

  @override
  String get q_mortgage_q_repayment_period => 'What repayment period suits you?';

  @override
  String get q_mortgage_repayment_label => 'Repayment period';

  @override
  String get q_mortgage_q_employment => 'What is your employment status?';

  @override
  String get q_opt_emp_government => 'Government employee';

  @override
  String get q_opt_emp_private => 'Private sector employee';

  @override
  String get q_opt_emp_business_owner => 'Business owner';

  @override
  String get q_opt_emp_freelancer => 'Freelancer';

  @override
  String get q_opt_emp_retired => 'Retired';

  @override
  String get q_mortgage_q_income => 'What is your average monthly income?';

  @override
  String get q_mortgage_hint_income => 'Monthly income';

  @override
  String get q_opt_income_b1 => 'Less than EGP 50,000';

  @override
  String get q_opt_income_b2 => 'EGP 50,000 – 100,000';

  @override
  String get q_opt_income_b3 => 'EGP 100,000 – 300,000';

  @override
  String get q_opt_income_b4 => 'EGP 300,000 – 600,000';

  @override
  String get q_opt_income_b5 => 'EGP 600,000 – 1,000,000';

  @override
  String get q_opt_income_b6 => 'More than EGP 1,000,000';

  @override
  String get q_mortgage_q_salary_transfer => 'Is your salary transferred to a bank account?';

  @override
  String get q_mortgage_q_additional_income => 'Do you have additional sources of income?';

  @override
  String get q_mortgage_q_current_loans => 'Do you currently have any loans or financial obligations?';

  @override
  String get q_mortgage_q_installments => 'What is the total amount of your monthly installments?';

  @override
  String get q_mortgage_installments_label => 'Monthly installments';

  @override
  String get q_mortgage_installments_hint => 'Monthly installment amount';

  @override
  String get q_mortgage_q_prior_rejection => 'Have you ever had a mortgage application rejected?';

  @override
  String get q_mortgage_q_priority => 'What is most important to you in mortgage financing?';

  @override
  String get q_opt_priority_lowest_installment => 'Lowest monthly installment';

  @override
  String get q_opt_priority_longest_period => 'Longest repayment period';

  @override
  String get q_opt_priority_lowest_down_payment => 'Lowest down payment';

  @override
  String get q_opt_priority_fastest_approval => 'Fastest approval';

  @override
  String get q_opt_priority_lowest_fees => 'Lowest administrative fees';

  @override
  String get q_mortgage_q_assistance => 'Do you need assistance preparing documents and completing procedures?';

  @override
  String get q_business_title => 'Business Loan Application';

  @override
  String get q_business_subtitle => 'We\'ll match you with banks that specialise in your needs';

  @override
  String get q_business_next => 'Next';

  @override
  String get q_business_finish => 'Finish';

  @override
  String get q_business_submitted => 'Your answers have been saved';

  @override
  String get q_business_select_hint => 'Select an option';

  @override
  String q_business_years(Object years) {
    return '$years years';
  }

  @override
  String get q_business_step1_title => 'Business & Financing Details';

  @override
  String get q_business_step2_title => 'Financial Information';

  @override
  String get q_business_step3_title => 'Obligations & Credit Status';

  @override
  String get q_business_step4_title => 'Preferences & Support';

  @override
  String get q_business_q_activity => 'What type of business or project do you operate?';

  @override
  String get q_business_hint_activity => 'Select business type';

  @override
  String get q_opt_biz_activity_trade => 'Trading';

  @override
  String get q_opt_biz_activity_services => 'Services';

  @override
  String get q_opt_biz_activity_food => 'Restaurants & Cafés';

  @override
  String get q_opt_biz_activity_manufacturing => 'Manufacturing';

  @override
  String get q_opt_biz_activity_technology => 'Technology';

  @override
  String get q_opt_biz_activity_other => 'Other';

  @override
  String get q_business_q_business_age => 'How long has the business been operating?';

  @override
  String get q_business_business_age_hint => 'No. of years';

  @override
  String get q_business_q_financing_amount => 'What is the approximate financing amount required?';

  @override
  String get q_business_financing_amount_hint => 'Financing amount required';

  @override
  String get q_business_q_purpose => 'What is the primary purpose of the financing?';

  @override
  String get q_business_hint_purpose => 'Select purpose';

  @override
  String get q_opt_biz_purpose_expansion => 'Expansion';

  @override
  String get q_opt_biz_purpose_equipment => 'Equipment Purchase';

  @override
  String get q_opt_biz_purpose_working_capital => 'Working Capital';

  @override
  String get q_opt_biz_purpose_new_branch => 'Opening a New Branch';

  @override
  String get q_opt_biz_purpose_settle_obligations => 'Debt Settlement';

  @override
  String get q_opt_biz_purpose_other => 'Other';

  @override
  String get q_business_repayment_label => 'Repayment period';

  @override
  String get q_business_q_revenue => 'What is the average monthly business revenue?';

  @override
  String get q_business_q_bank_account => 'Do you have a business bank account?';

  @override
  String get q_business_q_registered => 'Is the business officially registered?';

  @override
  String get q_opt_biz_registration_in_progress => 'Registration in Progress';

  @override
  String get q_business_q_tax => 'Do you have a tax registration or commercial registration?';

  @override
  String get q_business_q_current_facilities => 'Does the business currently have any loans or financing facilities?';

  @override
  String get q_business_q_installments => 'What is the total amount of current monthly obligations?';

  @override
  String get q_business_installments_label => 'Monthly obligations';

  @override
  String get q_business_installments_hint => 'Monthly Installment';

  @override
  String get q_business_q_prior_rejection => 'Has the business ever been declined for financing?';

  @override
  String get q_business_q_priority => 'What is most important to you in business financing?';

  @override
  String get q_opt_biz_priority_fast_approval => 'Fast Approval';

  @override
  String get q_opt_biz_priority_flexible_repayment => 'Flexible Repayment';

  @override
  String get q_opt_biz_priority_highest_amount => 'Highest Financing Amount';

  @override
  String get q_opt_biz_priority_lowest_interest => 'Lowest Interest Rate';

  @override
  String get q_opt_biz_priority_least_paperwork => 'Minimum Documentation';

  @override
  String get q_business_q_consultation => 'Would you like to consult with a business financing expert?';

  @override
  String get q_car_subtitle => 'We\'ll match you with banks that specialise in your needs';

  @override
  String get q_car_next => 'Next';

  @override
  String get q_car_finish => 'Finish';

  @override
  String get q_car_submitted => 'Your answers have been saved';

  @override
  String get q_car_select_hint => 'Select an option';

  @override
  String q_car_years(Object years) {
    return '$years years';
  }

  @override
  String get q_car_step1_title => 'Vehicle & Financing Information';

  @override
  String get q_car_step2_title => 'Employment & Income';

  @override
  String get q_car_step3_title => 'Financial Status';

  @override
  String get q_car_step4_title => 'Preferences';

  @override
  String get q_car_q_condition => 'Is the vehicle new or used?';

  @override
  String get q_opt_car_cond_new => 'New';

  @override
  String get q_opt_car_cond_used => 'Used';

  @override
  String get q_car_q_model_year => 'What is the vehicle model year?';

  @override
  String get q_opt_car_year_current => 'Current year model';

  @override
  String get q_opt_car_year_last3 => 'Within the last 3 years';

  @override
  String get q_opt_car_year_3_5 => '3 to 5 years old';

  @override
  String get q_opt_car_year_over5 => 'More than 5 years old';

  @override
  String get q_car_q_price => 'What is the approximate vehicle price?';

  @override
  String get q_car_q_down_payment => 'How much down payment do you have available?';

  @override
  String get q_opt_car_dp_none => 'No down payment';

  @override
  String get q_opt_car_dp_under20 => 'Less than 20%';

  @override
  String get q_opt_car_dp_20_40 => '20% – 40%';

  @override
  String get q_opt_car_dp_over40 => 'More than 40%';

  @override
  String get q_car_repayment_label => 'Repayment period';

  @override
  String get q_car_q_employment => 'What is your employment status?';

  @override
  String get q_car_q_income => 'What is your average monthly income?';

  @override
  String get q_opt_car_income_b1 => 'Less than EGP 10,000';

  @override
  String get q_opt_car_income_b2 => 'EGP 10,000 – 25,000';

  @override
  String get q_opt_car_income_b3 => 'EGP 25,000 – 50,000';

  @override
  String get q_opt_car_income_b4 => 'More than EGP 50,000';

  @override
  String get q_car_q_salary_transfer => 'Is your salary transferred to a bank account?';

  @override
  String get q_car_q_employer_approved => 'Is your employer approved by banks?';

  @override
  String get q_opt_car_emp_yes => 'Yes';

  @override
  String get q_opt_car_emp_no => 'No';

  @override
  String get q_opt_car_emp_unsure => 'Not sure';

  @override
  String get q_car_q_current_loans => 'Do you currently have obligations or loans?';

  @override
  String get q_car_installments_label => 'Monthly installments';

  @override
  String get q_car_installments_hint => 'Monthly installment amount';

  @override
  String get q_car_q_credit_card => 'Do you have active credit cards?';

  @override
  String get q_car_q_priority => 'Primary priority when choosing a car loan?';

  @override
  String get q_opt_priority_lowest_interest => 'Lowest interest rate';

  @override
  String get q_opt_priority_no_guarantor => 'Financing without a guarantor';

  @override
  String get q_car_q_insurance => 'Would you like vehicle insurance offers?';

  @override
  String get q_personal_subtitle => 'We\'ll match you with banks that specialise in your needs';

  @override
  String get q_personal_next => 'Next';

  @override
  String get q_personal_finish => 'Finish';

  @override
  String get q_personal_submitted => 'Your answers have been saved';

  @override
  String get q_personal_select_hint => 'Select an option';

  @override
  String get q_dyn_subtitle => 'We\'ll match you with banks that specialise in your needs';

  @override
  String get q_dyn_select_hint => 'Select an option';

  @override
  String get q_dyn_next => 'Next';

  @override
  String get q_dyn_finish => 'Finish';

  @override
  String get q_dyn_error_title => 'Something went wrong';

  @override
  String get q_dyn_error_message => 'We couldn\'t load the questionnaire. Please try again.';

  @override
  String get q_dyn_retry => 'Try again';

  @override
  String get q_dyn_empty => 'No questions are available right now.';

  @override
  String get q_dyn_select_many_hint => 'Select one or more';

  @override
  String get q_dyn_text_hint => 'Type your answer';

  @override
  String get q_dyn_number_hint => 'Enter a number';

  @override
  String get q_dyn_number_invalid => 'Enter a valid number.';

  @override
  String q_dyn_number_range(String min, String max) {
    return 'Enter a value between $min and $max.';
  }

  @override
  String q_dyn_number_min(String min) {
    return 'Enter $min or more.';
  }

  @override
  String q_dyn_number_max(String max) {
    return 'Enter $max or less.';
  }

  @override
  String q_dyn_number_step(String step) {
    return 'Enter a value in steps of $step.';
  }

  @override
  String q_dyn_number_step_nearest(String step, String lower, String upper) {
    return 'Values go up in ${step}s — nearest valid are $lower and $upper.';
  }

  @override
  String q_dyn_number_step_nearest_one(String step, String value) {
    return 'Values go up in ${step}s — nearest valid is $value.';
  }

  @override
  String q_dyn_number_step_helper(String step) {
    return 'In steps of $step';
  }

  @override
  String get q_dyn_obligations_total_helper => 'Added up from the payments you listed above.';

  @override
  String get q_dyn_money_missing => 'Fill in the amount, repayment period, income and current installments to see your offers.';

  @override
  String q_personal_years(Object years) {
    return '$years years';
  }

  @override
  String get q_personal_step1_title => 'Financing Details';

  @override
  String get q_personal_step2_title => 'Employment & Income';

  @override
  String get q_personal_step3_title => 'Banking Commitments';

  @override
  String get q_personal_step4_title => 'Preferences & Qualifications';

  @override
  String get q_personal_q_amount => 'What is the approximate amount you need?';

  @override
  String get q_personal_amount_label => 'Loan amount';

  @override
  String get q_personal_amount_hint => 'Approximate amount you need';

  @override
  String get q_personal_q_repayment => 'What repayment period suits you?';

  @override
  String get q_personal_repayment_label => 'Repayment period';

  @override
  String get q_personal_q_purpose => 'What is the purpose of the loan?';

  @override
  String get q_personal_hint_purpose => 'Purpose of the loan';

  @override
  String get q_opt_personal_purpose_home_finishing => 'Home finishing / Renovation';

  @override
  String get q_opt_personal_purpose_marriage => 'Marriage';

  @override
  String get q_opt_personal_purpose_appliances => 'Purchasing appliances or furniture';

  @override
  String get q_opt_personal_purpose_education => 'Education';

  @override
  String get q_opt_personal_purpose_debt_consolidation => 'Debt consolidation';

  @override
  String get q_opt_personal_purpose_personal_project => 'Personal project';

  @override
  String get q_opt_personal_purpose_other => 'Other';

  @override
  String get q_personal_q_employment => 'What is your employment status?';

  @override
  String get q_personal_q_job_tenure => 'How long have you been in your current job?';

  @override
  String get q_personal_hint_job_tenure => 'Current job';

  @override
  String get q_opt_personal_tenure_under6m => 'Less than 6 months';

  @override
  String get q_opt_personal_tenure_6m_1y => '6 months – 1 year';

  @override
  String get q_opt_personal_tenure_1_3y => '1–3 years';

  @override
  String get q_opt_personal_tenure_over3y => 'More than 3 years';

  @override
  String get q_personal_q_income => 'What is your average monthly income?';

  @override
  String get q_opt_personal_income_b1 => 'Start from EGP 10,000';

  @override
  String get q_opt_personal_income_b2 => 'EGP 10,000 – 20,000';

  @override
  String get q_opt_personal_income_b3 => 'EGP 20,000 – 50,000';

  @override
  String get q_opt_personal_income_b4 => 'EGP 50,000 – 80,000';

  @override
  String get q_opt_personal_income_b5 => 'More than EGP 100,000';

  @override
  String get q_personal_q_salary_transfer => 'Is your salary transferred to a bank account?';

  @override
  String get q_personal_q_employer_approved => 'Is your employer approved by banks?';

  @override
  String get q_opt_personal_emp_yes => 'Yes';

  @override
  String get q_opt_personal_emp_no => 'No';

  @override
  String get q_opt_personal_emp_unsure => 'Not sure';

  @override
  String get q_personal_q_obligations => 'Do you currently have any loans or financial obligations?';

  @override
  String get q_personal_hint_obligations => 'Loans or financial obligations';

  @override
  String get q_opt_personal_obligation_none => 'None';

  @override
  String get q_opt_personal_obligation_personal_loan => 'Personal Loan';

  @override
  String get q_opt_personal_obligation_car_loan => 'Car Loan';

  @override
  String get q_opt_personal_obligation_mortgage => 'Mortgage';

  @override
  String get q_opt_personal_obligation_credit_cards => 'Credit Cards';

  @override
  String get q_opt_personal_obligation_other => 'Other';

  @override
  String get q_personal_q_installment => 'What is your approximate total monthly installment amount?';

  @override
  String get q_personal_installment_label => 'Monthly installment';

  @override
  String get q_personal_installment_hint => 'Monthly installment';

  @override
  String get q_personal_q_credit_card => 'Do you have a credit card?';

  @override
  String get q_personal_q_credit_card_usage => 'If yes, what is your average monthly credit card usage?';

  @override
  String get q_opt_personal_cc_usage_b1 => 'Less than EGP 10,000';

  @override
  String get q_opt_personal_cc_usage_b2 => 'EGP 10,000 – 30,000';

  @override
  String get q_opt_personal_cc_usage_b3 => 'EGP 30,000 – 50,000';

  @override
  String get q_opt_personal_cc_usage_b4 => 'More than EGP 50,000';

  @override
  String get q_personal_q_priority => 'What is the most important factor when choosing financing?';

  @override
  String get q_opt_personal_priority_lowest_installment => 'Lowest Monthly Installment';

  @override
  String get q_opt_personal_priority_lowest_interest => 'Lowest Interest Rate';

  @override
  String get q_opt_personal_priority_minimum_docs => 'Minimum Documentation';

  @override
  String get q_opt_personal_priority_flexible_repayment => 'Flexible Repayment';

  @override
  String get q_personal_q_prior_rejection => 'Have you ever had a financing application rejected?';

  @override
  String get q_personal_q_assistance => 'Do you need assistance preparing documents and completing procedures?';

  @override
  String get profile_title => 'Profile';

  @override
  String get profile_section_personal => 'Personal Information';

  @override
  String get profile_section_contact => 'Contact Details';

  @override
  String get profile_edit => 'Edit';

  @override
  String get profile_first_name => 'First Name';

  @override
  String get profile_last_name => 'Last Name';

  @override
  String get profile_password => 'Password';

  @override
  String profile_password_changed(int count) {
    return 'Last changed $count months ago';
  }

  @override
  String get profile_password_hint => 'New password';

  @override
  String get profile_dob => 'Date of Birth';

  @override
  String get profile_dob_day => 'Day';

  @override
  String get profile_dob_month => 'Month';

  @override
  String get profile_dob_year => 'Year';

  @override
  String get profile_dob_hint => 'Select date of birth';

  @override
  String get profile_national_id => 'National ID';

  @override
  String get profile_national_id_hint => '— required for loan eligibility';

  @override
  String get profile_id_front => 'Front side';

  @override
  String get profile_id_back => 'Back side';

  @override
  String get profile_id_uploaded => 'Uploaded';

  @override
  String get profile_id_tap_to_upload => 'Tap to upload';

  @override
  String get profile_id_uploading => 'Uploading…';

  @override
  String get profile_id_checking => 'Checking…';

  @override
  String get profile_id_check_failed => 'Couldn\'t check';

  @override
  String get profile_id_unavailable => 'Tap to upload again';

  @override
  String get profile_id_upload_failed => 'Couldn\'t upload the ID. Please try again.';

  @override
  String get profile_save_failed => 'Couldn\'t save your profile. Please try again.';

  @override
  String get profile_save_success => 'Your profile has been updated.';

  @override
  String get profile_email_taken => 'This email is already in use by another account.';

  @override
  String get profile_dob_locked => 'Date of birth can\'t be changed once set.';

  @override
  String get profile_phone_readonly => 'Your phone number can\'t be changed.';

  @override
  String get profile_phone => 'Phone';

  @override
  String get profile_phone_hint => 'Phone number';

  @override
  String get profile_email => 'Email';

  @override
  String get profile_address => 'Address';

  @override
  String get profile_governorate => 'Governorate';

  @override
  String get profile_city => 'City';

  @override
  String get profile_save => 'Save';

  @override
  String get profile_cancel => 'Cancel';

  @override
  String get profile_search_hint => 'Search';

  @override
  String get results_title => 'Your top matches are ready';

  @override
  String get results_subtitle => 'Your loan advisor is ready';

  @override
  String get results_empty_title => 'No offers yet';

  @override
  String get results_empty_body => 'We couldn\'t find matching programs for your answers right now.';

  @override
  String get results_profile_title => 'Complete your profile';

  @override
  String get results_profile_body => 'Finish your profile to see loan offers.';

  @override
  String get results_profile_action => 'Complete profile';

  @override
  String get results_loan_type => 'Loan type';

  @override
  String get results_program => 'Program';

  @override
  String get results_amount => 'Amount';

  @override
  String get results_requested => 'Requested';

  @override
  String get results_requested_duration => 'Requested duration';

  @override
  String get results_approved_amount => 'Approved amount';

  @override
  String results_amount_egp(String amount) {
    return 'EGP $amount';
  }

  @override
  String get results_duration => 'Loan Duration';

  @override
  String results_months(int count) {
    return '$count months';
  }

  @override
  String results_guarantee_approval(int pct) {
    return '$pct% match';
  }

  @override
  String get results_unrated => 'Not rated yet';

  @override
  String get results_unavailable_section => 'Not available for you yet';

  @override
  String get results_unavailable_badge => 'No offer from this bank';

  @override
  String get results_unavailable_generic => 'This bank couldn\'t price an offer for you right now.';

  @override
  String results_unavailable_ceiling(String amount) {
    return 'You could borrow up to $amount EGP here.';
  }

  @override
  String get results_best_match => 'Best Match';

  @override
  String get results_rate => 'Rate';

  @override
  String get results_monthly => 'Monthly';

  @override
  String get results_total => 'Total';

  @override
  String get results_view_offer => 'View Offer';

  @override
  String get results_max_borrow => 'You could borrow up to';

  @override
  String results_max_borrow_value(String amount) {
    return 'EGP $amount';
  }

  @override
  String get offer_type_personal => 'Personal';

  @override
  String get offer_type_car => 'Car';

  @override
  String get offer_type_mortgage => 'Mortgage';

  @override
  String get offer_type_business => 'Business';

  @override
  String offer_title(String type) {
    return '$type Loan';
  }

  @override
  String offer_approval(int pct) {
    return '$pct% match score';
  }

  @override
  String get offer_unrated => 'Not rated yet';

  @override
  String get offer_interest_rate => 'Interest rate';

  @override
  String get offer_fixed_apr => 'Fixed APR';

  @override
  String get offer_monthly => 'Monthly';

  @override
  String get offer_egp_month => 'EGP / month';

  @override
  String get offer_duration => 'Duration';

  @override
  String get offer_months => 'months';

  @override
  String get offer_total_interest => 'Total interest';

  @override
  String get offer_total_interest_caption => 'interest over the term';

  @override
  String get offer_cash_received => 'Cash you receive';

  @override
  String get offer_cash_received_caption => 'after fees';

  @override
  String get offer_egp_extra => 'EGP paid extra';

  @override
  String get offer_national_id => 'National ID';

  @override
  String get offer_national_id_pending => 'Pending';

  @override
  String get offer_national_id_uploaded => 'Uploaded';

  @override
  String get offer_personal_id => 'personal ID';

  @override
  String get offer_total_loan => 'Total Loan';

  @override
  String get offer_total_loan_caption => 'incl. interest + principal';

  @override
  String get offer_max_borrow => 'Max you can borrow';

  @override
  String offer_max_borrow_caption(String pct) {
    return 'at a $pct% debt cap';
  }

  @override
  String get offer_dbr => 'Debt burden';

  @override
  String get offer_dbr_caption => 'of your monthly income';

  @override
  String get offer_headroom_hint => 'You asked for less than you qualify for.';

  @override
  String get offer_fees_title => 'Fees & charges';

  @override
  String get offer_admin_fees => 'Admin fees';

  @override
  String get offer_admin_fees_value => '1% (EGP 1,500)';

  @override
  String get offer_interest_charge => '12% - 15% from principal amount';

  @override
  String get offer_interest_charge_value => '12.5% / year';

  @override
  String offer_interest_charge_value_rate(String pct) {
    return '$pct% / year';
  }

  @override
  String get offer_stamp_duty => 'Stamp duty';

  @override
  String get offer_life_insurance => 'Life insurance';

  @override
  String offer_fee_egp(String amount) {
    return 'EGP $amount';
  }

  @override
  String get offer_early_settlement => 'Early settlement';

  @override
  String get offer_early_settlement_value => 'Free after 12M';

  @override
  String get offer_apply => 'Apply for this offer';

  @override
  String get offer_save_later => 'Save offer for later';

  @override
  String get offer_action_soon => 'Coming soon';

  @override
  String get offer_proceed_success => 'Your request was sent to the bank.';

  @override
  String get offer_proceed_error => 'Something went wrong. Please try again.';

  @override
  String get offer_national_id_required_title => 'National ID Required';

  @override
  String get offer_national_id_required_body => 'Upload the front and back of your National ID to continue with this application.';

  @override
  String get offer_national_id_required_cta => 'Upload now';

  @override
  String get apply_docs_title => 'Complete your documents';

  @override
  String get apply_docs_subtitle => 'Add your photo and National ID to send this application to the bank.';

  @override
  String get apply_docs_photo_section => 'Profile photo';

  @override
  String get apply_docs_photo_hint => 'required';

  @override
  String get apply_docs_cta => 'Continue application';

  @override
  String get apply_docs_upload_error => 'Couldn\'t upload that file. Please try again.';

  @override
  String get auth_profile_photo_required => 'Upload your profile photo before applying for a loan.';

  @override
  String get offer_save_success => 'Offer saved. Find it later in Saved Offers.';

  @override
  String get offer_save_error => 'Could not save this offer. Please try again.';

  @override
  String get offer_saved => 'Saved';

  @override
  String get offer_removed_success => 'Removed from saved.';

  @override
  String get offer_remove_error => 'Could not remove this offer. Please try again.';

  @override
  String get settings_security_title => 'Settings & Security';

  @override
  String get settings_section_privacy_security => 'Privacy & Security';

  @override
  String get settings_biometric_title => 'Biometric login';

  @override
  String get settings_biometric_subtitle => 'Face ID / Fingerprint';

  @override
  String get settings_biometric_confirm_reason => 'Confirm your fingerprint or Face ID to turn on biometric login';

  @override
  String get settings_biometric_unavailable => 'Biometric login isn\'t set up on this device yet';

  @override
  String get biometric_lock_title => 'Unlock Masrafy with Face ID or your fingerprint';

  @override
  String get biometric_lock_reason => 'Unlock Masrafy';

  @override
  String get biometric_lock_retry => 'Try again';

  @override
  String get biometric_lock_logout => 'Log out';

  @override
  String get settings_privacy_policies_title => 'Privacy Policies';

  @override
  String get settings_privacy_policies_subtitle => 'Privacy Policies - Term & Conditions';

  @override
  String get settings_section_notification_center => 'Notification center';

  @override
  String get settings_notifications_title => 'Enable Notifications';

  @override
  String get settings_notifications_subtitle => 'Get Notifications';

  @override
  String get settings_section_languages => 'Languages';

  @override
  String get settings_change_language_title => 'Change Language';

  @override
  String get settings_language_sheet_title => 'Change Language';

  @override
  String get settings_language_english => 'English';

  @override
  String get settings_language_arabic => 'Arabic';

  @override
  String get settings_change_password_title => 'Change Password';

  @override
  String get settings_change_password_subtitle => 'Update your account password';

  @override
  String get change_password_title => 'Change Password';

  @override
  String get change_password_hint => 'Enter your current password, then choose a new one with at least 12 characters including uppercase, lowercase, a number and a symbol.';

  @override
  String get change_password_current_label => 'Current Password';

  @override
  String get change_password_current_hint => 'Enter current password';

  @override
  String get change_password_new_label => 'New Password';

  @override
  String get change_password_new_hint => 'Enter new password';

  @override
  String get change_password_confirm_label => 'Confirm New Password';

  @override
  String get change_password_confirm_hint => 'Re-enter new password';

  @override
  String get change_password_action => 'Save';

  @override
  String get change_password_success => 'Password changed. Please sign in with your new password.';

  @override
  String get change_password_error_current_incorrect => 'Current password is incorrect.';

  @override
  String get change_password_error_same_as_old => 'New password must be different from the current one.';

  @override
  String get change_password_error_social_forbidden => 'Password change isn\'t available for social sign-in accounts.';

  @override
  String get change_password_error_policy => 'Password must be at least 12 characters and include uppercase, lowercase, a number and a symbol.';

  @override
  String get change_password_error_breached => 'This password appeared in a known data breach. Please choose a different one.';

  @override
  String get change_password_error_common => 'This password is too common. Please choose a stronger one.';

  @override
  String get change_password_error_breach_check_unavailable => 'We couldn\'t verify your password right now. Please try again in a moment.';

  @override
  String get change_password_error_account_inactive => 'Your account is not active. Please contact support.';

  @override
  String get change_password_error_mismatch => 'Passwords do not match';

  @override
  String get forgot_password_phone_title => 'Reset your password';

  @override
  String get forgot_password_phone_subtitle => 'Enter your phone number and we\'ll send you a verification code.';

  @override
  String get forgot_password_phone_hint => 'We\'ll send a 6-digit code to your phone to confirm it\'s you.';

  @override
  String get forgot_password_send_cta => 'Send code';

  @override
  String get forgot_password_otp_title => 'Verify your phone number';

  @override
  String get forgot_password_new_title => 'Set a new password';

  @override
  String get forgot_password_new_subtitle => 'Choose a strong new password for your account.';

  @override
  String get forgot_password_new_hint => 'Choose a new password with at least 12 characters including uppercase, lowercase, a number and a symbol.';

  @override
  String get forgot_password_reset_cta => 'Reset password';

  @override
  String get forgot_password_success => 'Password reset. Please sign in with your new password.';

  @override
  String get forgot_password_error_unavailable => 'We couldn\'t reset the password for this number. Please try again or contact support.';

  @override
  String get photo_source_title => 'Profile Photo';

  @override
  String get photo_source_camera => 'Take Photo';

  @override
  String get photo_source_gallery => 'Choose from Gallery';

  @override
  String get profile_photo_upload_failed => 'Couldn\'t upload the photo. Please try again.';

  @override
  String get error_answer_type_mismatch => 'This answer doesn\'t match the question type.';

  @override
  String get error_answer_out_of_range => 'This number is outside the allowed range.';

  @override
  String get error_answer_too_long => 'This answer is too long.';

  @override
  String get error_answer_required => 'Please answer this question.';

  @override
  String get error_money_figure_missing => 'A figure needed for the estimate is missing. Please review your answers.';

  @override
  String get error_calculator_input_invalid => 'Please check the amount, term, income and existing payments.';

  @override
  String get error_calculator_program_inactive => 'This program is not available right now.';

  @override
  String get error_obligations_total_mismatch => 'Your monthly payments didn\'t add up. Please review your debts and try again.';

  @override
  String get reason_no_recognised_income => 'We couldn\'t recognise a monthly income for this program.';

  @override
  String get reason_obligations_exceed_allowance => 'Your current monthly payments already use up the allowed limit.';

  @override
  String get reason_below_program_min_amount => 'The affordable amount is below this program\'s minimum.';

  @override
  String get reason_age_at_maturity => 'No available term keeps you within this program\'s age limit.';

  @override
  String get reason_currency_not_offered => 'This program doesn\'t offer the requested currency.';

  @override
  String get reason_program_misconfigured => 'This program can\'t be priced right now.';

  @override
  String get reason_surrogate_fact_missing => 'This program needs a detail we haven\'t asked you for yet, so no figures can be shown.';

  @override
  String get reason_surrogate_no_matching_row => 'This bank\'s table doesn\'t cover your answer, so no figures can be shown.';

  @override
  String get disclaimer_indicative_estimate => 'Indicative estimate — not a binding offer. Final figures come from the bank.';

  @override
  String get id_capture_title_front => 'Front side of your ID';

  @override
  String get id_capture_title_back => 'Back side of your ID';

  @override
  String get id_capture_hint => 'Place your National ID inside the frame, then tap the shutter.';

  @override
  String get id_capture_retry => 'Try again';

  @override
  String get id_capture_close => 'Close camera';

  @override
  String get id_capture_shutter => 'Capture';

  @override
  String get id_capture_torch_on => 'Turn on the light';

  @override
  String get id_capture_torch_off => 'Turn off the light';

  @override
  String get id_capture_error => 'Couldn\'t start the camera on this device.';

  @override
  String get id_capture_permission_error => 'Camera access is off. Allow the camera for Masrafy in your device settings, then try again.';

  @override
  String get id_capture_capture_error => 'Couldn\'t save that shot. Please take it again.';
}
