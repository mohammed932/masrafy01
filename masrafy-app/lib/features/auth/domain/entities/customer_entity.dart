import 'package:equatable/equatable.dart';

import '../enums/registration_path.dart';
import '../enums/social_provider.dart';

/// Feature 008 — Two-Path Registration customer entity.
///
/// Replaces the legacy `features/auth/.../customer_entity.dart` (non-null phone).
/// `phone`, `mobileVerifiedAt`, `email`, `age` are nullable for SOCIAL customers
/// pending the Complete-Profile flow. `requiresProfileCompletion` is the boolean
/// the mobile app consults before showing the gate popup on Apply.
class CustomerEntity extends Equatable {
  const CustomerEntity({
    required this.id,
    required this.registrationPath,
    required this.name,
    required this.hasPassword,
    required this.linkedProviders,
    required this.profileComplete,
    required this.isVerified,
    required this.createdAt,
    this.phone,
    this.mobileVerifiedAt,
    this.email,
    this.age,
    this.birthday,
    this.photoUrl,
    this.lastLoginAt,
  });

  final String id;
  final RegistrationPath registrationPath;
  final String name;
  final bool hasPassword;
  final List<SocialProvider> linkedProviders;

  /// Authoritative profile-completeness flag from the backend (Principle
  /// XXXVII). When false the account is gated to the Complete-Profile flow.
  final bool profileComplete;

  /// Account verification status from the backend.
  final bool isVerified;

  final DateTime createdAt;

  /// Null for SOCIAL customers pending Complete-Profile. Once set, immutable.
  final String? phone;

  /// Null until OTP-verified. Once set, immutable.
  final DateTime? mobileVerifiedAt;

  /// May be null at registration for SOCIAL customers whose provider withheld it.
  final String? email;

  /// Null until first loan submission for SOCIAL customers. Once set, immutable.
  final int? age;

  /// Calendar date of birth, source of [age] (Principle XXXVII / A31 — the age
  /// is derived, never stored). Null until the customer sets it on
  /// Complete-Profile, EXCEPT on the Google path where it may already be
  /// prefilled from the People API — which is exactly what that screen reads to
  /// avoid asking for a date the provider already gave us.
  final DateTime? birthday;

  /// Presigned GET URL for the profile photo. Set once a photo exists — either
  /// uploaded by the customer or imported from the Google avatar at sign-up.
  final String? photoUrl;

  final DateTime? lastLoginAt;

  /// Authoritative: the backend computes completeness (Principle XXXVII).
  bool get requiresProfileCompletion => !profileComplete;

  @override
  List<Object?> get props => [
        id,
        registrationPath,
        name,
        hasPassword,
        linkedProviders,
        profileComplete,
        isVerified,
        createdAt,
        phone,
        mobileVerifiedAt,
        email,
        age,
        birthday,
        photoUrl,
        lastLoginAt,
      ];
}

class CustomerSessionEntity extends Equatable {
  const CustomerSessionEntity({
    required this.accessToken,
    required this.refreshToken,
    required this.customer,
  });

  final String accessToken;
  final String refreshToken;
  final CustomerEntity customer;

  @override
  List<Object?> get props => [
        accessToken,
        refreshToken,
        customer,
      ];
}
