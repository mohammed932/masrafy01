import '../../../domain/entities/customer_entity.dart';
import 'customer_model.dart';

/// Wire-format envelope for `POST /api/v1/auth/{signup,login,refresh}`.
/// Lives in `data/models/response/` per Constitution Principle XXX.
class CustomerAuthEnvelopeModel {
  const CustomerAuthEnvelopeModel({
    required this.accessToken,
    required this.refreshToken,
    required this.customer,
  });

  factory CustomerAuthEnvelopeModel.fromJson(Map<String, dynamic> json) {
    return CustomerAuthEnvelopeModel(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      customer: CustomerModel.fromJson(
        json['customer'] as Map<String, dynamic>,
      ),
    );
  }

  final String accessToken;
  final String refreshToken;
  final CustomerModel customer;

  CustomerSessionEntity toEntity() => CustomerSessionEntity(
        accessToken: accessToken,
        refreshToken: refreshToken,
        customer: customer.toEntity(),
      );
}
