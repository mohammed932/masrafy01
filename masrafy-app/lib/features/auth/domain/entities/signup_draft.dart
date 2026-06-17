import 'package:equatable/equatable.dart';

/// The PHONE-signup details collected on the Create-Account screen and carried
/// to the OTP screen (as route args). After the mobile is OTP-verified the OTP
/// cubit combines these with the `verifiedMobileToken` into a
/// [SignupPhoneCompleteRequest]. Photo + National ID are NOT here — their
/// upload is deferred (see plan / Principle XXXVII follow-up).
class SignupDraft extends Equatable {
  const SignupDraft({
    required this.firstName,
    required this.lastName,
    required this.phone,
    required this.password,
    required this.age,
    this.email,
  });

  final String firstName;
  final String lastName;

  /// Full E.164-style number (dial code + national number) used for display,
  /// resend, and the masked-destination fallback.
  final String phone;
  final String password;

  /// Derived from the birthday at submit time — never stored as state-of-record
  /// (Principle XXXVII / A31). Sent only because the current
  /// `SignupPhoneCompleteRequest` DTO still takes `age` (flagged DTO debt).
  final int age;
  final String? email;

  String get fullName => '$firstName $lastName'.trim();

  @override
  List<Object?> get props => [firstName, lastName, phone, password, age, email];
}
