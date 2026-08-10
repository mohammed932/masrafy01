import 'package:equatable/equatable.dart';

/// The currently-authenticated customer, as returned by `GET /api/v1/auth/me`.
///
/// Carries only the fields the Profile screen renders. Fields the backend has
/// no source for (National ID number, address, password-changed date) are NOT
/// part of this entity — those rows are hidden on the Profile screen.
class CustomerProfileEntity extends Equatable {
  const CustomerProfileEntity({
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

  /// E.164-ish phone as stored (e.g. `+201012345678`); may be empty for a
  /// SOCIAL account that has not bound a mobile yet.
  final String phone;
  final String? email;

  /// Date of birth; null until the profile-completion step sets it.
  final DateTime? birthday;

  /// Presigned GET URL for the profile photo; null when none uploaded.
  final String? photoUrl;

  /// Egyptian governorate slug; null when not set.
  final String? governorate;

  /// City; null when not set.
  final String? city;

  /// Address line; null when not set.
  final String? address;

  @override
  List<Object?> get props => [
        id,
        firstName,
        lastName,
        phone,
        email,
        birthday,
        photoUrl,
        governorate,
        city,
        address
      ];
}
