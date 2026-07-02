import 'package:equatable/equatable.dart';

/// The PHONE-signup details collected on the Create-Account screen and carried
/// to the OTP screen (as route args). Once the mobile is OTP-verified, the OTP
/// cubit creates the LITE account; this draft is then forwarded to the
/// Complete-Profile screen to prefill name / birthday / email / password.
/// Photo + National ID are NOT here — they are uploaded on Complete-Profile
/// (they need the customer JWT issued at verify, and National ID is optional).
class SignupDraft extends Equatable {
  const SignupDraft({
    required this.firstName,
    required this.lastName,
    required this.phone,
    required this.password,
    required this.birthday,
    this.email,
  });

  final String firstName;
  final String lastName;

  /// Full E.164-style number (dial code + national number) used for display,
  /// resend, and the masked-destination fallback.
  final String phone;
  final String password;

  /// Date of birth (sent to `/profile/complete`; age derived, never stored —
  /// Principle XXXVII / A31).
  final DateTime birthday;
  final String? email;

  String get fullName => '$firstName $lastName'.trim();

  /// Age derived from [birthday] (never persisted).
  int get age {
    final now = DateTime.now();
    var years = now.year - birthday.year;
    if (now.month < birthday.month ||
        (now.month == birthday.month && now.day < birthday.day)) {
      years--;
    }
    return years;
  }

  @override
  List<Object?> get props => [firstName, lastName, phone, password, birthday, email];
}
