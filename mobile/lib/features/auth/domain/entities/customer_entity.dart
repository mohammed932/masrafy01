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
    required this.createdAt,
    this.phone,
    this.mobileVerifiedAt,
    this.email,
    this.age,
    this.lastLoginAt,
  });

  final String id;
  final RegistrationPath registrationPath;
  final String name;
  final bool hasPassword;
  final List<SocialProvider> linkedProviders;
  final DateTime createdAt;

  /// Null for SOCIAL customers pending Complete-Profile. Once set, immutable.
  final String? phone;

  /// Null until OTP-verified. Once set, immutable.
  final DateTime? mobileVerifiedAt;

  /// May be null at registration for SOCIAL customers whose provider withheld it.
  final String? email;

  /// Null until first loan submission for SOCIAL customers. Once set, immutable.
  final int? age;

  final DateTime? lastLoginAt;

  bool get requiresProfileCompletion =>
      phone == null || email == null || age == null;

  @override
  List<Object?> get props => [
        id,
        registrationPath,
        name,
        hasPassword,
        linkedProviders,
        createdAt,
        phone,
        mobileVerifiedAt,
        email,
        age,
        lastLoginAt,
      ];
}

class CustomerSessionEntity extends Equatable {
  const CustomerSessionEntity({
    required this.accessToken,
    required this.accessTokenExpiresIn,
    required this.refreshToken,
    required this.refreshTokenExpiresIn,
    required this.customer,
  });

  final String accessToken;
  final int accessTokenExpiresIn;
  final String refreshToken;
  final int refreshTokenExpiresIn;
  final CustomerEntity customer;

  @override
  List<Object?> get props => [
        accessToken,
        accessTokenExpiresIn,
        refreshToken,
        refreshTokenExpiresIn,
        customer,
      ];
}
