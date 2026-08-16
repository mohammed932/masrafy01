/// How the bank works out the applicant's income — the customer-facing half of
/// `bank_program.programType`.
///
/// This is NOT a loan category (Principle II scope-lock / A26). v15.0.0 shipped
/// the no-payslip product as a fifth category `fast` and v16.0.0 removed it: the
/// same catalog name is sold against a payslip by one bank and against a grade
/// table by another, so a category duplicated every sellable name and asked the
/// customer to choose between two descriptions of one loan. It is a property of
/// the PROGRAM, which is why the customer picks it as a filter over programs
/// rather than as a product.
///
/// [code] is the wire value, identical to the Prisma `BankProgramType` enum. The
/// two raw values are never rendered — see the ARB strings.
enum IncomeType {
  /// The bank reads a payslip / salary transfer.
  incomeProof,

  /// The bank works the income out some other way (a grade table, a licence
  /// class, years in practice, a card limit).
  incomeSurrogate;

  String get code => switch (this) {
        IncomeType.incomeProof => 'income_proof',
        IncomeType.incomeSurrogate => 'income_surrogate',
      };

  /// Parse a backend value. Returns null for anything unknown rather than
  /// defaulting: an unrecognised basis must not silently become "payslip" and
  /// send the customer down the wrong half of the catalog.
  static IncomeType? fromCode(String? code) => switch (code) {
        'income_proof' => IncomeType.incomeProof,
        'income_surrogate' => IncomeType.incomeSurrogate,
        _ => null,
      };
}
