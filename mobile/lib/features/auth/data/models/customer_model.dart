import '../../domain/entities/customer_entity.dart';

class CustomerModel {
  CustomerModel({
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

class CustomerAuthEnvelopeModel {
  CustomerAuthEnvelopeModel({
    required this.accessToken,
    required this.accessTokenExpiresIn,
    required this.refreshToken,
    required this.refreshTokenExpiresIn,
    required this.customer,
  });

  factory CustomerAuthEnvelopeModel.fromJson(Map<String, dynamic> json) {
    return CustomerAuthEnvelopeModel(
      accessToken: json['accessToken'] as String,
      accessTokenExpiresIn: json['accessTokenExpiresIn'] as int,
      refreshToken: json['refreshToken'] as String,
      refreshTokenExpiresIn: json['refreshTokenExpiresIn'] as int,
      customer:
          CustomerModel.fromJson(json['customer'] as Map<String, dynamic>),
    );
  }

  final String accessToken;
  final int accessTokenExpiresIn;
  final String refreshToken;
  final int refreshTokenExpiresIn;
  final CustomerModel customer;

  CustomerSessionEntity toEntity() => CustomerSessionEntity(
        accessToken: accessToken,
        accessTokenExpiresIn: accessTokenExpiresIn,
        refreshToken: refreshToken,
        refreshTokenExpiresIn: refreshTokenExpiresIn,
        customer: customer.toEntity(),
      );
}
