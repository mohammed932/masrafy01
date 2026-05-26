import 'package:equatable/equatable.dart';

class CustomerEntity extends Equatable {
  const CustomerEntity({
    required this.id,
    required this.phone,
    required this.name,
    required this.locale,
    required this.isVerified,
    required this.createdAt,
    this.email,
    this.lastLoginAt,
  });

  final String id;
  final String phone;
  final String name;
  final String locale;
  final bool isVerified;
  final DateTime createdAt;
  final String? email;
  final DateTime? lastLoginAt;

  @override
  List<Object?> get props =>
      [id, phone, name, locale, isVerified, createdAt, email, lastLoginAt];
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
