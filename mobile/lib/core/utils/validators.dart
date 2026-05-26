class Validators {
  Validators._();

  static final _emailRegex = RegExp(
    r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
  );
  static final _usernameRegex = RegExp(r'^[a-zA-Z0-9_]+$');
  static final _phoneCountryCodeRegex = RegExp(r'^\+[1-9]\d{0,3}$');
  static final _phoneNumberRegex = RegExp(r'^\d{5,20}$');
  static final _fullNameRegex = RegExp(r"^[\p{L}][\p{L}\s''\-]*$", unicode: true);
  static final _strongPasswordRegex = RegExp(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,128}$',
  );

  static String? email(String? value) {
    if (value == null || value.isEmpty) return 'Email is required';
    if (!_emailRegex.hasMatch(value.trim())) return 'Enter a valid email';
    return null;
  }

  static String? nonEmpty(String? value, {String field = 'This field'}) {
    if (value == null || value.isEmpty) return '$field is required';
    return null;
  }

  static String? username(String? value) {
    if (value == null || value.isEmpty) return 'Username is required';
    if (value.length < 3 || value.length > 30) {
      return 'Username must be 3–30 characters';
    }
    if (!_usernameRegex.hasMatch(value)) {
      return 'Only letters, numbers, and underscore';
    }
    return null;
  }

  static String? phoneCountryCode(String? value) {
    if (value == null || value.isEmpty) return 'CountryEntity code is required';
    if (!_phoneCountryCodeRegex.hasMatch(value)) {
      return 'Use format like +20';
    }
    return null;
  }

  static String? phoneNumber(String? value) {
    if (value == null || value.isEmpty) return 'Phone number is required';
    if (!_phoneNumberRegex.hasMatch(value)) {
      return 'Enter 5–20 digits';
    }
    return null;
  }

  static String? countryName(String? value) {
    if (value == null || value.isEmpty) return 'CountryEntity is required';
    if (value.length < 2 || value.length > 100) {
      return 'CountryEntity name is too short or too long';
    }
    return null;
  }

  /// Full name: 2–100 chars, starts with Unicode letter, only letters/spaces/hyphens/apostrophes.
  static String? fullName(String? value) {
    if (value == null || value.trim().isEmpty) return 'Full name is required';
    final trimmed = value.trim();
    if (trimmed.length < 2) return 'Minimum 2 characters';
    if (trimmed.length > 100) return 'Maximum 100 characters';
    if (!_fullNameRegex.hasMatch(trimmed)) {
      return 'Name can only contain letters, spaces, hyphens, and apostrophes';
    }
    return null;
  }

  /// Strong password: 8–128 chars, at least one uppercase, one lowercase,
  /// one digit, one special (non-alphanumeric, non-whitespace).
  static String? strongPassword(String? value) {
    if (value == null || value.isEmpty) return 'Password is required';
    if (value.length < 8) return 'At least 8 characters';
    if (value.length > 128) return 'At most 128 characters';
    if (!_strongPasswordRegex.hasMatch(value)) {
      return 'Must include uppercase, lowercase, digit, and special character';
    }
    return null;
  }

  /// Confirm password: must match the original.
  static String? passwordsMatch(String? value, {required String password}) {
    if (value == null || value.isEmpty) return 'Please confirm your password';
    if (value != password) return 'Passwords do not match';
    return null;
  }

  static String? required(String? value, {String field = 'This field'}) {
    if (value == null || value.trim().isEmpty) return '$field is required';
    return null;
  }

  static String? minLength(String? value, {required int min, String field = 'This field'}) {
    if (value == null || value.isEmpty) return '$field is required';
    if (value.length < min) return '$field must be $min characters or more';
    return null;
  }

  static String? maxLength(String? value, {required int max, String field = 'This field'}) {
    if (value == null) return null;
    if (value.length > max) return '$field must be $max characters or fewer';
    return null;
  }

  // --- Per-criterion helpers for PasswordStrengthIndicator (FR-048) ---

  static bool hasMinLength(String value) => value.length >= 8;
  static bool hasUppercase(String value) => value.contains(RegExp(r'[A-Z]'));
  static bool hasLowercase(String value) => value.contains(RegExp(r'[a-z]'));
  static bool hasDigit(String value) => value.contains(RegExp(r'\d'));
  static bool hasSpecial(String value) =>
      value.contains(RegExp(r'[^\w\s]', unicode: true));
}
