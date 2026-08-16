import 'package:app/features/loan_setup/domain/enums/income_type.dart';
import 'package:app/features/questionnaire/domain/enums/loan_category.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// Locale-resolved words for the two enums the wizard walks through.
///
/// Kept out of `LoanSetupState` on purpose: the state is pure derivation over
/// what the customer picked, and a `BuildContext`-derived label on it would make
/// every computed getter locale-dependent. Kept out of the step widgets too,
/// because the hero subtitle on step 3 has to name the choice made on step 2 —
/// three files would otherwise each spell the same switch.
///
/// Neither raw wire value (`personal`, `income_surrogate`) is ever rendered.
String categoryLabel(AppLocalizations l, LoanCategory category) =>
    switch (category) {
      LoanCategory.personal => l.home_cat_personal,
      LoanCategory.mortgage => l.home_cat_mortgage,
      LoanCategory.car => l.home_cat_car,
      LoanCategory.business => l.home_cat_business,
    };

String incomeTypeLabel(AppLocalizations l, IncomeType type) => switch (type) {
      IncomeType.incomeProof => l.loan_setup_income_proof_title,
      IncomeType.incomeSurrogate => l.loan_setup_income_surrogate_title,
    };

String incomeTypeDescription(AppLocalizations l, IncomeType type) =>
    switch (type) {
      IncomeType.incomeProof => l.loan_setup_income_proof_desc,
      IncomeType.incomeSurrogate => l.loan_setup_income_surrogate_desc,
    };

/// The choices made so far, as one hero subtitle line. Grows as the customer
/// advances, so every step says what it is narrowing without them walking back.
String breadcrumb(
  AppLocalizations l,
  LoanCategory category,
  IncomeType? incomeType,
) {
  final parts = <String>[categoryLabel(l, category)];
  if (incomeType != null) parts.add(incomeTypeLabel(l, incomeType));
  return parts.join(' · ');
}
