import '../../../domain/entities/customer_entity.dart';

/// Wire-format customer DTO. Lives in `data/models/response/` per
/// Constitution Principle XXX — `Model` suffix marks a response DTO.
/// Mappers stay at the bottom of the file.
class CustomerModel {
  const CustomerModel({
    required this.id,
    required this.phone,
    required this.name,
    required this.locale,
    required this.isVerified,
    required this.createdAt,
    this.email,
    this.lastLoginAt,
  });

  factory CustomerModel.fromJson(Map<String, dynamic> json) {
    return CustomerModel(
      id: json['id'] as String,
      phone: json['phone'] as String,
      name: json['name'] as String,
      locale: json['locale'] as String,
      isVerified: json['isVerified'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
      email: json['email'] as String?,
      lastLoginAt: json['lastLoginAt'] == null
          ? null
          : DateTime.parse(json['lastLoginAt'] as String),
    );
  }

  final String id;
  final String phone;
  final String name;
  final String locale;
  final bool isVerified;
  final DateTime createdAt;
  final String? email;
  final DateTime? lastLoginAt;

  CustomerEntity toEntity() => CustomerEntity(
        id: id,
        phone: phone,
        name: name,
        locale: locale,
        isVerified: isVerified,
        createdAt: createdAt,
        email: email,
        lastLoginAt: lastLoginAt,
      );
}
