/// `PATCH /api/v1/auth/profile` — post-completion scalar edit. Every field is
/// optional; `toJson` omits nulls so each screen sends only the fields it owns
/// (partial update). NEVER carries phone (immutable), birthday (immutable), or
/// password (its own flow).
class UpdateProfileRequest {
  const UpdateProfileRequest({
    this.firstName,
    this.lastName,
    this.email,
    this.governorate,
    this.city,
    this.address,
  });

  final String? firstName;
  final String? lastName;
  final String? email;
  final String? governorate;
  final String? city;
  final String? address;

  Map<String, dynamic> toJson() => {
        if (firstName != null) 'firstName': firstName,
        if (lastName != null) 'lastName': lastName,
        if (email != null) 'email': email,
        if (governorate != null) 'governorate': governorate,
        if (city != null) 'city': city,
        if (address != null) 'address': address,
      };
}
