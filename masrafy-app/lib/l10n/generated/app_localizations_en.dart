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
  String get auth_password_not_set => 'This account has no password. Sign in with Google or Apple.';

  @override
  String get auth_password_same_as_old => 'Pick a new password different from the current one.';

  @override
  String get auth_profile_incomplete => 'Complete your profile to continue.';

  @override
  String get auth_profile_field_immutable => 'This field cannot be changed once set.';

  @override
  String get auth_phone_mutation_on_phone_customer_forbidden => 'Mobile number is already set on this account.';

  @override
  String get auth_password_change_forbidden_for_social => 'Password change is not available for accounts using Google or Apple sign-in.';

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
  String get auth_landing_action_apple => 'Continue with Apple';

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
}
