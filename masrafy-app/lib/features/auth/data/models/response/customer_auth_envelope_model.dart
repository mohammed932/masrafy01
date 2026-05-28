import '../../../domain/entities/customer_entity.dart';
import 'customer_model.dart';

/// Wire-format envelope for `POST /api/v1/auth/{signup,login,refresh}`.
/// Lives in `data/models/response/` per Constitution Principle XXX.
class CustomerAuthEnvelopeModel {
  const CustomerAuthEnvelopeModel({
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
      customer: CustomerModel.fromJson(
        json['customer'] as Map<String, dynamic>,
      ),
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
