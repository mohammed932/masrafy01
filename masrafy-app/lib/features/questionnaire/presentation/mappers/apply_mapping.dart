/// Shared pure helpers that translate the Figma wizards' option-bucket answers
/// into the typed values `POST /api/v1/apply` expects (see the per-category
/// `*_apply_mapper.dart`). Bucket→representative-value choices are documented
/// approximations for the MVP (backend uses income + amount + tenor for the
/// money math); refine with product as needed.
///
/// Money helpers emit decimal strings (Constitution Principle I / A3).
library;

/// Backend apply bounds (`ApplyRequestDto`).
const double _minAmountEgp = 5000;
const double _maxAmountEgp = 50000000;
const int _minTenorMonths = 6;
const int _maxTenorMonths = 360;

/// Format any amount as a 2-decimal string, never negative.
String egp(num value) => (value < 0 ? 0 : value).toDouble().toStringAsFixed(2);

/// Format a requested principal, clamped to the backend's 5,000–50,000,000 band.
String amountEgp(num value) =>
    value.clamp(_minAmountEgp, _maxAmountEgp).toDouble().toStringAsFixed(2);

/// Years (wizard slider) → months, clamped to the backend's 6–360 band.
int tenorMonths(double years) =>
    (years * 12).round().clamp(_minTenorMonths, _maxTenorMonths);

/// Midpoint of a range-slider's two bounds.
double midpoint(double start, double end) => (start + end) / 2;

/// Wizard `salaryTransfer` yes/no → backend `salaryTransferType` enum value.
String salaryTransferType({required bool? transfers}) =>
    transfers == true ? 'payroll' : 'none';

/// Derive `companyType` from the employment id (never collected by the wizard;
/// the engine only reads it for bank-employee programs).
String companyTypeFor(String employmentType) =>
    employmentType == 'government_employee' ? 'public_bank' : 'commercial_bank';

/// Job-tenure bucket → representative `monthsInJob`. [fallback] covers wizards
/// that don't ask (car / mortgage / business).
int monthsFromTenure(String? bucket, {int fallback = 24}) {
  switch (bucket) {
    case 'under_6m':
      return 3;
    case '6m_1y':
      return 9;
    case '1_3y':
      return 24;
    case 'over_3y':
      return 48;
    default:
      return fallback;
  }
}

/// Map any wizard `priorityFactor` id → backend `priority` enum
/// (`lowest_installment | lowest_interest | fastest_approval | least_paperwork`).
/// Only affects ranking; unmapped → `fastest_approval`.
String mapPriority(String? id) {
  switch (id) {
    case 'lowest_installment':
    case 'flexible_repayment':
    case 'lowest_down_payment':
    case 'longest_period':
    case 'highest_amount':
      return 'lowest_installment';
    case 'lowest_interest':
      return 'lowest_interest';
    case 'minimum_docs':
    case 'least_paperwork':
    case 'no_guarantor':
    case 'lowest_fees':
      return 'least_paperwork';
    case 'fastest_approval':
    default:
      return 'fastest_approval';
  }
}
