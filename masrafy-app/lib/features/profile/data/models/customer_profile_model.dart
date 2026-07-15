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
        birthday: _parseDate(birthday),
        photoUrl: (photoUrl != null && photoUrl!.isNotEmpty) ? photoUrl : null,
        governorate: governorate,
        city: city,
        address: address,
      );

  /// Parses `birthday` as a pure calendar date. The backend sends it either as
  /// `yyyy-MM-dd` or as UTC midnight (`yyyy-MM-ddT00:00:00.000Z`) — both encode
  /// the same calendar day. We take only the `yyyy-MM-dd` prefix and build a
  /// naive (local, no-TZ) `DateTime`, so display (`DateFormat`) and the
  /// `yyyy-MM-dd` re-serialization on save agree and round-trip exactly. Using
  /// `DateTime.tryParse` instead yields a UTC-flagged value that renders one
  /// day off on negative-offset devices → spurious `PROFILE_FIELD_IMMUTABLE`.
  static DateTime? _parseDate(String? iso) {
    if (iso == null || iso.isEmpty) return null;
    final datePart = iso.split('T').first;
    final parts = datePart.split('-');
    if (parts.length != 3) return DateTime.tryParse(iso);
    final y = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    final d = int.tryParse(parts[2]);
    if (y == null || m == null || d == null) return DateTime.tryParse(iso);
    return DateTime(y, m, d);
  }
}
