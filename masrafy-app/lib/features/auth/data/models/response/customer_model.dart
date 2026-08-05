import '../../../domain/entities/customer_entity.dart';
import '../../../domain/enums/registration_path.dart';
import '../../../domain/enums/social_provider.dart';

/// Wire-format customer DTO. Lives in `data/models/response/` per
/// Constitution Principle XXX — `Model` suffix marks a response DTO.
/// Mappers stay at the bottom of the file.
///
/// Feature 008: `phone` is now NULLABLE for SOCIAL customers pending the
/// Complete-Profile flow. Fields `registrationPath`, `mobileVerifiedAt`,
/// `age`, `hasPassword`, `linkedProviders` are new in v1.8.0.
class CustomerModel {
  const CustomerModel({
    required this.id,
    required this.registrationPath,
    required this.name,
    required this.locale,
    required this.hasPassword,
    required this.linkedProviders,
    required this.profileComplete,
    required this.isVerified,
    required this.createdAt,
    this.phone,
    this.mobileVerifiedAt,
    this.email,
    this.age,
    this.lastLoginAt,
  });

  factory CustomerModel.fromJson(Map<String, dynamic> json) {
    final pathStr = (json['registrationPath'] as String? ?? 'PHONE').toUpperCase();
    final path = pathStr == 'SOCIAL' ? RegistrationPath.social : RegistrationPath.phone;
    // Google is the only social provider (constitution v11.0.0).
    final providers = (json['linkedProviders'] as List<dynamic>? ?? const [])
        .map((_) => SocialProvider.google)
        .toList(growable: false);
    return CustomerModel(
      id: json['id'] as String,
      registrationPath: path,
      name: _composeName(json),
      locale: json['locale'] as String? ?? 'ar-EG',
      hasPassword: json['hasPassword'] as bool? ?? (pathStr == 'PHONE'),
      linkedProviders: providers,
      profileComplete: json['profileComplete'] as bool? ?? false,
      isVerified: json['isVerified'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
      phone: json['phone'] as String?,
      mobileVerifiedAt: json['mobileVerifiedAt'] == null
          ? null
          : DateTime.parse(json['mobileVerifiedAt'] as String),
      email: json['email'] as String?,
      age: (json['age'] as num?)?.toInt(),
      lastLoginAt: json['lastLoginAt'] == null
          ? null
          : DateTime.parse(json['lastLoginAt'] as String),
    );
  }

  /// Backend sends `firstName`/`lastName` separately; compose a display name,
  /// falling back to a pre-composed `name`/`fullName` for forward-compat.
  static String _composeName(Map<String, dynamic> json) {
    final first = (json['firstName'] as String? ?? '').trim();
    final last = (json['lastName'] as String? ?? '').trim();
    final composed = [first, last].where((p) => p.isNotEmpty).join(' ');
    if (composed.isNotEmpty) return composed;
    return ((json['name'] ?? json['fullName'] ?? '') as String).trim();
  }

  final String id;
  final RegistrationPath registrationPath;
  final String name;
  final String locale;
  final bool hasPassword;
  final List<SocialProvider> linkedProviders;
  final bool profileComplete;
  final bool isVerified;
  final DateTime createdAt;
  final String? phone;
  final DateTime? mobileVerifiedAt;
  final String? email;
  final int? age;
  final DateTime? lastLoginAt;

  CustomerEntity toEntity() => CustomerEntity(
        id: id,
        registrationPath: registrationPath,
        name: name,
        hasPassword: hasPassword,
        linkedProviders: linkedProviders,
        profileComplete: profileComplete,
        isVerified: isVerified,
        createdAt: createdAt,
        phone: phone,
        mobileVerifiedAt: mobileVerifiedAt,
        email: email,
        age: age,
        lastLoginAt: lastLoginAt,
      );
}
