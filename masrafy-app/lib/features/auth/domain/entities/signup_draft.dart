import 'package:equatable/equatable.dart';

import 'package:app/core/utils/image_pick.dart';

/// The PHONE-signup details collected on the Create-Account screen and carried
/// to the OTP screen (as route args). Once the mobile is OTP-verified, the OTP
/// cubit creates the LITE account; this draft is then forwarded to the
/// Complete-Profile screen to prefill name / birthday / email / password.
///
/// [nationalIdFront] / [nationalIdBack] are the sides captured on the signup
/// screen. They ride along as bytes because the upload endpoints are
/// customer-scoped: there is no JWT until the OTP is verified, so the OTP cubit
/// sends them right after the session is issued. Both stay optional (Principle
/// XXXVII, narrowed v9.0.0) — a signup with neither is a complete signup.
/// The profile photo is not collected here at all.
class SignupDraft extends Equatable {
  const SignupDraft({
    required this.firstName,
    required this.lastName,
    required this.phone,
    required this.password,
    required this.birthday,
    this.email,
    this.nationalIdFront,
    this.nationalIdBack,
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

  /// Captured before the account existed; uploaded once it does.
  final PickedImage? nationalIdFront;
  final PickedImage? nationalIdBack;

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
  List<Object?> get props => [
        firstName,
        lastName,
        phone,
        password,
        birthday,
        email,
        nationalIdFront,
        nationalIdBack,
      ];
}
