import 'package:app/core/entities/user_entity.dart';

/// Wire-format DTO — extends the domain [UserEntity] entity so consumers that
/// type against `UserEntity` transparently accept a `UserModel`. Hand-written
/// `fromJson`/`toJson` to avoid json_serializable field-shadowing noise.
class UserModel extends UserEntity {
  const UserModel({
    required super.id,
    required super.email,
    super.username,
    super.role,
    super.verified,
    super.isActive,
    UserProfileModel? super.profile,
    UserSubscriptionModel? super.subscription,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    // Active = any subscription with status==ACTIVE && endDate>=now.
    // Pick the latest-ending one (mirrors Angular `hasActiveSubscription`).
    UserSubscriptionModel? subscription;
    final subs = json['subscriptions'] as List<dynamic>?;
    if (subs != null) {
      final now = DateTime.now();
      DateTime? latestEnd;
      String? activeTier;
      for (final raw in subs) {
        if (raw is! Map<String, dynamic>) continue;
        if (raw['status'] != 'ACTIVE') continue;
        final endStr = raw['endDate'] as String?;
        final end = endStr == null ? null : DateTime.tryParse(endStr);
        if (end == null || end.isBefore(now)) continue;
        if (latestEnd == null || end.isAfter(latestEnd)) {
          latestEnd = end;
          final pkg = raw['package'] as Map<String, dynamic>?;
          activeTier = pkg?['licenseType'] as String?;
        }
      }
      if (latestEnd != null) {
        subscription = UserSubscriptionModel(
          isActive: true,
          tier: activeTier,
          expiresAt: latestEnd,
        );
      }
    }

    return UserModel(
      id: json['id'] as String,
      email: json['email'] as String,
      username: json['username'] as String?,
      role: json['role'] as String?,
      verified: json['verified'] as bool? ?? false,
      isActive: json['isActive'] as bool? ?? true,
      profile: json['profile'] == null
          ? null
          : UserProfileModel.fromJson(json['profile'] as Map<String, dynamic>),
      subscription: subscription,
    );
  }
}

class UserProfileModel extends UserProfileEntity {
  const UserProfileModel({
    super.fullName,
    super.bio,
    super.imageUrl,
    super.countryName,
    super.phoneCountryCode,
    super.phoneNumber,
  });

  factory UserProfileModel.fromJson(Map<String, dynamic> json) =>
      UserProfileModel(
        fullName: json['fullName'] as String?,
        bio: json['bio'] as String?,
        imageUrl: json['imageUrl'] as String?,
        countryName: json['countryName'] as String?,
        phoneCountryCode: json['phoneCountryCode'] as String?,
        phoneNumber: json['phoneNumber'] as String?,
      );
}

class UserSubscriptionModel extends UserSubscriptionEntity {
  const UserSubscriptionModel({
    required super.isActive,
    super.tier,
    super.expiresAt,
  });

  factory UserSubscriptionModel.fromJson(Map<String, dynamic> json) =>
      UserSubscriptionModel(
        isActive: json['isActive'] as bool,
        tier: json['tier'] as String?,
        expiresAt: json['expiresAt'] == null
            ? null
            : DateTime.parse(json['expiresAt'] as String),
      );
}
