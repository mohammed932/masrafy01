/// A lookup value the operator maintains in the admin dashboard.
///
/// [key] is the language-neutral id sent to and stored by the backend; the two
/// labels are what a person reads. Never send a label over the wire.
class PlatformEnumerationEntity {
  const PlatformEnumerationEntity({
    required this.key,
    required this.labelEn,
    required this.labelAr,
  });

  final String key;
  final String labelEn;
  final String labelAr;

  String label({required bool isArabic}) => isArabic ? labelAr : labelEn;
}
