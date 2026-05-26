class CountryEntity {
  final String name;
  final String code;

  const CountryEntity({required this.name, required this.code});

  @override
  bool operator ==(Object other) =>
      other is CountryEntity && other.name == name && other.code == code;

  @override
  int get hashCode => Object.hash(name, code);
}

abstract final class CountryList {
  CountryList._();

  // Mirrors the Angular billing-address component's hardcoded list (sorted).
  static const List<CountryEntity> all = [
    CountryEntity(name: 'Australia', code: 'AU'),
    CountryEntity(name: 'Austria', code: 'AT'),
    CountryEntity(name: 'Bahrain', code: 'BH'),
    CountryEntity(name: 'Belgium', code: 'BE'),
    CountryEntity(name: 'Canada', code: 'CA'),
    CountryEntity(name: 'Czech Republic', code: 'CZ'),
    CountryEntity(name: 'Denmark', code: 'DK'),
    CountryEntity(name: 'Egypt', code: 'EG'),
    CountryEntity(name: 'Finland', code: 'FI'),
    CountryEntity(name: 'France', code: 'FR'),
    CountryEntity(name: 'Germany', code: 'DE'),
    CountryEntity(name: 'Greece', code: 'GR'),
    CountryEntity(name: 'Hungary', code: 'HU'),
    CountryEntity(name: 'Ireland', code: 'IE'),
    CountryEntity(name: 'Italy', code: 'IT'),
    CountryEntity(name: 'Kuwait', code: 'KW'),
    CountryEntity(name: 'Netherlands', code: 'NL'),
    CountryEntity(name: 'Norway', code: 'NO'),
    CountryEntity(name: 'Oman', code: 'OM'),
    CountryEntity(name: 'Poland', code: 'PL'),
    CountryEntity(name: 'Portugal', code: 'PT'),
    CountryEntity(name: 'Qatar', code: 'QA'),
    CountryEntity(name: 'Romania', code: 'RO'),
    CountryEntity(name: 'Saudi Arabia', code: 'SA'),
    CountryEntity(name: 'Spain', code: 'ES'),
    CountryEntity(name: 'Sweden', code: 'SE'),
    CountryEntity(name: 'Switzerland', code: 'CH'),
    CountryEntity(name: 'United Arab Emirates', code: 'AE'),
    CountryEntity(name: 'United Kingdom', code: 'GB'),
    CountryEntity(name: 'United States', code: 'US'),
  ];

  static CountryEntity? byName(String name) {
    try {
      return all.firstWhere(
        (c) => c.name.toLowerCase() == name.toLowerCase(),
      );
    } catch (_) {
      return null;
    }
  }
}
