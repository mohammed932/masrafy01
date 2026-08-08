/// A lookup value the operator maintains in the admin dashboard.
///
/// [key] is the language-neutral id sent to and stored by the backend; the two
/// labels are what a person reads. Never send a label over the wire.
class PlatformEnumerationEntity {
  const PlatformEnumerationEntity({
    required this.key,
    required this.labelEn,
    required this.labelAr,
    this.categories = const [],
  });

  final String key;
  final String labelEn;
  final String labelAr;

  /// Loan categories (`personal|car|mortgage|business`) this member may be
  /// offered under. Only the categorised registry types carry any — for every
  /// other type it is always empty, and the callers of those never read it.
  ///
  /// On a categorised type (today: `program_name`) an EMPTY list means PARKED —
  /// offerable nowhere — not "unrestricted". [offeredUnder] keeps that reading
  /// in one place, because the lenient one silently offers the customer a
  /// program name the backend then rejects.
  final List<String> categories;

  String label({required bool isArabic}) => isArabic ? labelAr : labelEn;

  /// True when this member may be offered under [category] (a category slug).
  bool offeredUnder(String category) => categories.contains(category);
}
