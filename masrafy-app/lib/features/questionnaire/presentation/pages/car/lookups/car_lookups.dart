import 'package:app/core/widgets/input_controls/masrafy_expandable_select.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// Local, static option lists for the car-loan questionnaire dropdowns
/// ("add lookups for now" — no backend questionnaire call this iteration,
/// mirroring `MortgageLookups`).
///
/// Each option's `value` is a stable, language-neutral id that maps to the
/// backend car `QuestionOption.profileValue`/code; the `label` is localized at
/// call time.
class CarLookups {
  CarLookups._();

  static List<MasrafySelectOption<bool>> yesNo(AppLocalizations l) => [
        MasrafySelectOption(value: true, label: l.q_common_yes),
        MasrafySelectOption(value: false, label: l.q_common_no),
      ];

  static List<MasrafySelectOption<String>> vehicleConditions(
          AppLocalizations l) =>
      [
        MasrafySelectOption(value: 'new', label: l.q_opt_car_cond_new),
        MasrafySelectOption(value: 'used', label: l.q_opt_car_cond_used),
      ];

  static List<MasrafySelectOption<String>> modelYears(AppLocalizations l) => [
        MasrafySelectOption(value: 'current', label: l.q_opt_car_year_current),
        MasrafySelectOption(value: 'last_3', label: l.q_opt_car_year_last3),
        MasrafySelectOption(value: '3_5', label: l.q_opt_car_year_3_5),
        MasrafySelectOption(value: 'over_5', label: l.q_opt_car_year_over5),
      ];

  static List<MasrafySelectOption<String>> downPaymentBuckets(
          AppLocalizations l) =>
      [
        MasrafySelectOption(value: 'no_dp', label: l.q_opt_car_dp_none),
        MasrafySelectOption(value: 'under_20', label: l.q_opt_car_dp_under20),
        MasrafySelectOption(value: '20_40', label: l.q_opt_car_dp_20_40),
        MasrafySelectOption(value: 'over_40', label: l.q_opt_car_dp_over40),
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
        MasrafySelectOption(value: 'cb1', label: l.q_opt_car_income_b1),
        MasrafySelectOption(value: 'cb2', label: l.q_opt_car_income_b2),
        MasrafySelectOption(value: 'cb3', label: l.q_opt_car_income_b3),
        MasrafySelectOption(value: 'cb4', label: l.q_opt_car_income_b4),
      ];

  static List<MasrafySelectOption<String>> employerApproved(
          AppLocalizations l) =>
      [
        MasrafySelectOption(value: 'yes', label: l.q_opt_car_emp_yes),
        MasrafySelectOption(value: 'no', label: l.q_opt_car_emp_no),
        MasrafySelectOption(value: 'unsure', label: l.q_opt_car_emp_unsure),
      ];

  static List<MasrafySelectOption<String>> priorityFactors(
          AppLocalizations l) =>
      [
        MasrafySelectOption(
            value: 'lowest_down_payment',
            label: l.q_opt_priority_lowest_down_payment),
        MasrafySelectOption(
            value: 'lowest_installment',
            label: l.q_opt_priority_lowest_installment),
        MasrafySelectOption(
            value: 'fastest_approval',
            label: l.q_opt_priority_fastest_approval),
        MasrafySelectOption(
            value: 'lowest_interest', label: l.q_opt_priority_lowest_interest),
        MasrafySelectOption(
            value: 'no_guarantor', label: l.q_opt_priority_no_guarantor),
      ];
}
