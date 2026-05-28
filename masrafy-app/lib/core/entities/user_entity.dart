/// Pure domain entity representing the authenticated masrafy. No JSON
/// serialization, no remote-format concerns — consumers (cubits, services,
/// widgets) reason about this shape. The data layer's `UserModel` knows
/// how to build a [UserEntity] via `.toEntity()`.
class UserEntity {
  final String id;
  final String email;
  final String? username;
  final String? role;
  final bool verified;
  final bool isActive;
  final UserProfileEntity? profile;
  final UserSubscriptionEntity? subscription;

  const UserEntity({
    required this.id,
    required this.email,
    this.username,
    this.role,
    this.verified = false,
    this.isActive = true,
    this.profile,
    this.subscription,
  });

  UserEntity copyWith({
    String? id,
    String? email,
    String? username,
    String? role,
    bool? verified,
    bool? isActive,
    UserProfileEntity? profile,
    UserSubscriptionEntity? subscription,
  }) =>
      UserEntity(
        id: id ?? this.id,
        email: email ?? this.email,
        username: username ?? this.username,
        role: role ?? this.role,
        verified: verified ?? this.verified,
        isActive: isActive ?? this.isActive,
        profile: profile ?? this.profile,
        subscription: subscription ?? this.subscription,
      );
}

class UserProfileEntity {
  final String? fullName;
  final String? bio;
  final String? imageUrl;
  final String? countryName;
  final String? phoneCountryCode;
  final String? phoneNumber;

  const UserProfileEntity({
    this.fullName,
    this.bio,
    this.imageUrl,
    this.countryName,
    this.phoneCountryCode,
    this.phoneNumber,
  });
}

class UserSubscriptionEntity {
  final bool isActive;
  final String? tier;
  final DateTime? expiresAt;

  const UserSubscriptionEntity({
    required this.isActive,
    this.tier,
    this.expiresAt,
  });
}
