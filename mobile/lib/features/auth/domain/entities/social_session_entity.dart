import 'package:equatable/equatable.dart';

import '../enums/social_provider.dart';
import 'customer_entity.dart';

class SocialProfilePreview extends Equatable {
  const SocialProfilePreview({this.email, this.fullName, required this.emailVerified});
  final String? email;
  final String? fullName;
  final bool emailVerified;
  @override
  List<Object?> get props => [email, fullName, emailVerified];
}

class SocialSessionEntity extends Equatable {
  const SocialSessionEntity({
    required this.socialSessionId,
    required this.provider,
    required this.profile,
    this.existingCustomer,
    this.newCustomerSession,
  });

  final String? socialSessionId;
  final SocialProvider provider;
  final SocialProfilePreview profile;

  /// Set when (provider, providerUserId) maps to an existing customer.
  /// Caller should hit `/auth/social/login` with `socialSessionId` to sign in.
  final ExistingCustomerSummary? existingCustomer;

  /// Set when the social sign-in created a brand-new lite SOCIAL customer
  /// and issued tokens inline (no separate login call needed).
  final CustomerSessionEntity? newCustomerSession;

  @override
  List<Object?> get props =>
      [socialSessionId, provider, profile, existingCustomer, newCustomerSession];
}

class ExistingCustomerSummary extends Equatable {
  const ExistingCustomerSummary({required this.id, this.maskedPhone});
  final String id;
  final String? maskedPhone;
  @override
  List<Object?> get props => [id, maskedPhone];
}
