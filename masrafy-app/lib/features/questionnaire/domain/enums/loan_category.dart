/// The retail loan categories the platform supports (Constitution Principle II
/// scope-lock). [code] is the language-neutral slug used as the
/// `GET /api/v1/questionnaire/:category` path param and the `apply` payload's
/// `category` field.
///
/// Every value names WHAT is financed. The no-payslip product is deliberately not one
/// of them: v15.0.0 shipped it as a fifth category (`fast`) and v16.0.0 removed it,
/// because whether the bank reads a payslip or works an income out from a fact about
/// the applicant is a property of the BANK PROGRAM, not of the product the customer
/// picks. A personal applicant is asked those facts and is matched against both kinds.
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
