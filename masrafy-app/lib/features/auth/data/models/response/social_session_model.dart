import '../../../domain/entities/social_session_entity.dart';
import '../../../domain/enums/social_provider.dart';
import 'customer_auth_envelope_model.dart';

/// Wire-format response for `/auth/social/google` (feature 008). Returns either
/// an `existingCustomer` summary (caller will then hit `/auth/social/login` with
/// `socialSessionId`) or a `newCustomer` session envelope (the lite SOCIAL
/// customer was just created + tokens issued inline).
class SocialSessionModel {
  const SocialSessionModel({
    required this.provider,
    required this.profile,
    this.socialSessionId,
    this.existingCustomer,
    this.newCustomer,
  });

  factory SocialSessionModel.fromJson(Map<String, dynamic> json) {
    // Google is the only provider the API can return (constitution v11.0.0).
    const provider = SocialProvider.google;
    final profile = json['profile'] as Map<String, dynamic>? ?? const {};
    final existing = json['existingCustomer'] as Map<String, dynamic>?;
    final newCust = json['newCustomer'] as Map<String, dynamic>?;
    return SocialSessionModel(
      socialSessionId: json['socialSessionId'] as String?,
      provider: provider,
      profile: SocialProfileModel(
        email: profile['email'] as String?,
        fullName: profile['fullName'] as String?,
        emailVerified: profile['emailVerified'] as bool? ?? false,
      ),
      existingCustomer: existing != null
          ? ExistingCustomerSummaryModel(
              id: existing['id'] as String,
              maskedPhone: (existing['maskedPhone'] ?? existing['maskedMobile']) as String?,
            )
          : null,
      newCustomer: newCust != null
          ? CustomerAuthEnvelopeModel.fromJson(newCust['tokens'] as Map<String, dynamic>)
          : null,
    );
  }

  final String? socialSessionId;
  final SocialProvider provider;
  final SocialProfileModel profile;
  final ExistingCustomerSummaryModel? existingCustomer;
  final CustomerAuthEnvelopeModel? newCustomer;

  SocialSessionEntity toEntity() => SocialSessionEntity(
        socialSessionId: socialSessionId,
        provider: provider,
        profile: SocialProfilePreview(
          email: profile.email,
          fullName: profile.fullName,
          emailVerified: profile.emailVerified,
        ),
        existingCustomer: existingCustomer != null
            ? ExistingCustomerSummary(
                id: existingCustomer!.id,
                maskedPhone: existingCustomer!.maskedPhone,
              )
            : null,
        newCustomerSession: newCustomer?.toEntity(),
      );
}

class SocialProfileModel {
  const SocialProfileModel({this.email, this.fullName, required this.emailVerified});
  final String? email;
  final String? fullName;
  final bool emailVerified;
}

class ExistingCustomerSummaryModel {
  const ExistingCustomerSummaryModel({required this.id, this.maskedPhone});
  final String id;
  final String? maskedPhone;
}
