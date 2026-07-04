/// The four retail loan categories the platform supports (Constitution
/// Principle II scope-lock). [code] is the language-neutral slug used as the
/// `GET /api/v1/questionnaire/:category` path param and the `apply` payload's
/// `category` field.
enum LoanCategory {
  personal,
  car,
  mortgage,
  business;

  String get code => switch (this) {
        LoanCategory.personal => 'personal',
        LoanCategory.car => 'car',
        LoanCategory.mortgage => 'mortgage',
        LoanCategory.business => 'business',
      };

  /// Parse a backend/category slug back to the enum, defaulting to [personal]
  /// for anything unrecognised (the snapshot always echoes a known category).
  static LoanCategory fromCode(String code) => switch (code.toLowerCase()) {
        'car' => LoanCategory.car,
        'mortgage' => LoanCategory.mortgage,
        'business' => LoanCategory.business,
        _ => LoanCategory.personal,
      };
}
