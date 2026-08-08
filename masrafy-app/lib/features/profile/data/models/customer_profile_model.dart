import 'package:app/core/utils/calendar_date.dart';
import 'package:app/features/profile/domain/entities/customer_profile_entity.dart';

/// Wire model for `GET /api/v1/auth/me`. Hand-written `fromJson` (the app does
/// not use json_serializable for these). `birthday` arrives as an ISO date
/// string (`yyyy-mm-dd`) or is absent; `photoUrl` is a presigned URL or absent.
class CustomerProfileModel {
  const CustomerProfileModel({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.phone,
    this.email,
    this.birthday,
    this.photoUrl,
    this.governorate,
    this.city,
    this.address,
  });

  final String id;
  final String firstName;
  final String lastName;
  final String phone;
  final String? email;
  final String? birthday;
  final String? photoUrl;
  final String? governorate;
  final String? city;
  final String? address;

  factory CustomerProfileModel.fromJson(Map<String, dynamic> json) {
    return CustomerProfileModel(
      id: (json['id'] as String?) ?? '',
      firstName: (json['firstName'] as String?) ?? '',
      lastName: (json['lastName'] as String?) ?? '',
      phone: (json['phone'] as String?) ?? '',
      email: json['email'] as String?,
      birthday: json['birthday'] as String?,
      photoUrl: json['photoUrl'] as String?,
      governorate: json['governorate'] as String?,
      city: json['city'] as String?,
      address: json['address'] as String?,
    );
  }

  CustomerProfileEntity toEntity() => CustomerProfileEntity(
        id: id,
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        email: email,
        birthday: parseCalendarDate(birthday),
        photoUrl: (photoUrl != null && photoUrl!.isNotEmpty) ? photoUrl : null,
        governorate: governorate,
        city: city,
        address: address,
      );

}
