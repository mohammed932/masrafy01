import 'package:app/core/utils/egypt_governorates.dart';
import 'package:app/core/widgets/input_controls/masrafy_expandable_select.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// Local, static option lists for the mortgage questionnaire dropdowns
/// ("add lookups for now" — no backend questionnaire call this iteration).
///
/// Each option's `value` is a stable, language-neutral id that maps to the
/// backend mortgage `QuestionOption.code`; the `label` is localized at call
/// time. The governorate list follows the existing hardcoded-data precedent
/// (`phone_dial_codes.dart` / `CountryList`) — proper-noun reference data, not
/// UI chrome — so it is bilingual in-file rather than ~27 ARB keys.
class MortgageLookups {
  MortgageLookups._();

  static List<MasrafySelectOption<bool>> yesNo(AppLocalizations l) => [
        MasrafySelectOption(value: true, label: l.q_common_yes),
        MasrafySelectOption(value: false, label: l.q_common_no),
      ];

  static List<MasrafySelectOption<String>> propertyTypes(AppLocalizations l) =>
      [
        MasrafySelectOption(value: 'apartment', label: l.q_opt_property_apartment),
        MasrafySelectOption(value: 'villa', label: l.q_opt_property_villa),
        MasrafySelectOption(value: 'duplex', label: l.q_opt_property_duplex),
        MasrafySelectOption(
            value: 'commercial_shop', label: l.q_opt_property_commercial),
        MasrafySelectOption(value: 'office', label: l.q_opt_property_office),
        MasrafySelectOption(value: 'other', label: l.q_opt_property_other),
      ];

  static List<MasrafySelectOption<String>> registrationStatuses(
          AppLocalizations l) =>
      [
        MasrafySelectOption(value: 'registered', label: l.q_opt_reg_registered),
        MasrafySelectOption(value: 'eligible', label: l.q_opt_reg_eligible),
        MasrafySelectOption(
            value: 'not_registered', label: l.q_opt_reg_not_registered),
        MasrafySelectOption(value: 'unsure', label: l.q_opt_reg_unsure),
      ];

  static List<MasrafySelectOption<String>> downPaymentBuckets(
          AppLocalizations l) =>
      [
        MasrafySelectOption(value: 'under_10', label: l.q_opt_dp_under10),
        MasrafySelectOption(value: '10_20', label: l.q_opt_dp_10_20),
        MasrafySelectOption(value: '20_30', label: l.q_opt_dp_20_30),
        MasrafySelectOption(value: 'over_30', label: l.q_opt_dp_over30),
      ];

  static List<MasrafySelectOption<String>> employmentStatuses(
          AppLocalizations l) =>
      [
        MasrafySelectOption(
            value: 'government_employee', label: l.q_opt_emp_government),
        MasrafySelectOption(
            value: 'private_employee', label: l.q_opt_emp_private),
        MasrafySelectOption(
            value: 'business_owner', label: l.q_opt_emp_business_owner),
        MasrafySelectOption(value: 'freelancer', label: l.q_opt_emp_freelancer),
        MasrafySelectOption(value: 'retired', label: l.q_opt_emp_retired),
      ];

  static List<MasrafySelectOption<String>> incomeBands(AppLocalizations l) => [
        MasrafySelectOption(value: 'b1', label: l.q_opt_income_b1),
        MasrafySelectOption(value: 'b2', label: l.q_opt_income_b2),
        MasrafySelectOption(value: 'b3', label: l.q_opt_income_b3),
        MasrafySelectOption(value: 'b4', label: l.q_opt_income_b4),
        MasrafySelectOption(value: 'b5', label: l.q_opt_income_b5),
        MasrafySelectOption(value: 'b6', label: l.q_opt_income_b6),
      ];

  static List<MasrafySelectOption<String>> priorityFactors(
          AppLocalizations l) =>
      [
        MasrafySelectOption(
            value: 'lowest_installment',
            label: l.q_opt_priority_lowest_installment),
        MasrafySelectOption(
            value: 'longest_period', label: l.q_opt_priority_longest_period),
        MasrafySelectOption(
            value: 'lowest_down_payment',
            label: l.q_opt_priority_lowest_down_payment),
        MasrafySelectOption(
            value: 'fastest_approval',
            label: l.q_opt_priority_fastest_approval),
        MasrafySelectOption(
            value: 'lowest_fees', label: l.q_opt_priority_lowest_fees),
      ];

  /// The 27 Egyptian governorates — mapped from the shared
  /// [EgyptGovernorates] reference list (Principle XXXIII).
  static List<MasrafySelectOption<String>> governorates(AppLocalizations l) {
    final isArabic = l.localeName.startsWith('ar');
    return [
      for (final g in EgyptGovernorates.all)
        MasrafySelectOption(value: g.slug, label: g.label(isArabic)),
    ];
  }
}
