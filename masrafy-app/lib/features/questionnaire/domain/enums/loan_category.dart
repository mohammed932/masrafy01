/// The four retail loan categories Masrafy supports (Constitution
/// Principle II scope-lock). `wireValue` is the lowercase token the
/// backend `/api/v1/questionnaire/{category}` + `/matching/preview`
/// endpoints expect.
enum LoanCategory {
  personal,
  car,
  mortgage,
  business;

  String get wireValue => switch (this) {
        LoanCategory.personal => 'personal',
        LoanCategory.car => 'car',
        LoanCategory.mortgage => 'mortgage',
        LoanCategory.business => 'business',
      };

  static LoanCategory fromWire(String wire) => switch (wire) {
        'personal' => LoanCategory.personal,
        'car' => LoanCategory.car,
        'mortgage' => LoanCategory.mortgage,
        'business' => LoanCategory.business,
        _ => LoanCategory.personal,
      };
}
