import 'package:app/core/widgets/input_controls/masrafy_multi_select_field.dart';
import 'package:app/core/widgets/input_controls/masrafy_single_select_sheet.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// Local, static option lists for the personal-loan questionnaire selects
/// ("add lookups for now" — no backend questionnaire call this iteration,
/// mirroring `CarLookups`).
///
/// Each option's `value` is a stable, language-neutral id; the `label` is
/// localized at call time. Employment statuses reuse the shared `q_opt_emp_*`
/// keys (Principle IV — no duplicated strings).
class PersonalLookups {
  PersonalLookups._();

  static List<MasrafySelectOption<bool>> yesNo(AppLocalizations l) => [
        MasrafySelectOption(value: true, label: l.q_common_yes),
        MasrafySelectOption(value: false, label: l.q_common_no),
      ];

  static List<MasrafySelectOption<String>> loanPurposes(AppLocalizations l) => [
        MasrafySelectOption(
            value: 'home_finishing',
            label: l.q_opt_personal_purpose_home_finishing),
        MasrafySelectOption(
            value: 'marriage', label: l.q_opt_personal_purpose_marriage),
        MasrafySelectOption(
            value: 'appliances', label: l.q_opt_personal_purpose_appliances),
        MasrafySelectOption(
            value: 'education', label: l.q_opt_personal_purpose_education),
        MasrafySelectOption(
            value: 'debt_consolidation',
            label: l.q_opt_personal_purpose_debt_consolidation),
        MasrafySelectOption(
            value: 'personal_project',
            label: l.q_opt_personal_purpose_personal_project),
        MasrafySelectOption(
            value: 'other', label: l.q_opt_personal_purpose_other),
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

  static List<MasrafySelectOption<String>> jobTenures(AppLocalizations l) => [
        MasrafySelectOption(
            value: 'under_6m', label: l.q_opt_personal_tenure_under6m),
        MasrafySelectOption(
            value: '6m_1y', label: l.q_opt_personal_tenure_6m_1y),
        MasrafySelectOption(
            value: '1_3y', label: l.q_opt_personal_tenure_1_3y),
        MasrafySelectOption(
            value: 'over_3y', label: l.q_opt_personal_tenure_over3y),
      ];

  static List<MasrafySelectOption<String>> incomeBands(AppLocalizations l) => [
        MasrafySelectOption(value: 'cb1', label: l.q_opt_personal_income_b1),
        MasrafySelectOption(value: 'cb2', label: l.q_opt_personal_income_b2),
        MasrafySelectOption(value: 'cb3', label: l.q_opt_personal_income_b3),
        MasrafySelectOption(value: 'cb4', label: l.q_opt_personal_income_b4),
        MasrafySelectOption(value: 'cb5', label: l.q_opt_personal_income_b5),
      ];

  static List<MasrafySelectOption<String>> employerApproved(
          AppLocalizations l) =>
      [
        MasrafySelectOption(value: 'yes', label: l.q_opt_personal_emp_yes),
        MasrafySelectOption(value: 'no', label: l.q_opt_personal_emp_no),
        MasrafySelectOption(
            value: 'unsure', label: l.q_opt_personal_emp_unsure),
      ];

  static List<MasrafyMultiSelectOption<String>> obligationTypes(
          AppLocalizations l) =>
      [
        MasrafyMultiSelectOption(
            value: 'none', label: l.q_opt_personal_obligation_none),
        MasrafyMultiSelectOption(
            value: 'personal_loan',
            label: l.q_opt_personal_obligation_personal_loan),
        MasrafyMultiSelectOption(
            value: 'car_loan', label: l.q_opt_personal_obligation_car_loan),
        MasrafyMultiSelectOption(
            value: 'mortgage', label: l.q_opt_personal_obligation_mortgage),
        MasrafyMultiSelectOption(
            value: 'credit_cards',
            label: l.q_opt_personal_obligation_credit_cards),
        MasrafyMultiSelectOption(
            value: 'other', label: l.q_opt_personal_obligation_other),
      ];

  static List<MasrafySelectOption<String>> creditCardUsageBands(
          AppLocalizations l) =>
      [
        MasrafySelectOption(value: 'b1', label: l.q_opt_personal_cc_usage_b1),
        MasrafySelectOption(value: 'b2', label: l.q_opt_personal_cc_usage_b2),
        MasrafySelectOption(value: 'b3', label: l.q_opt_personal_cc_usage_b3),
        MasrafySelectOption(value: 'b4', label: l.q_opt_personal_cc_usage_b4),
      ];

  static List<MasrafySelectOption<String>> priorityFactors(
          AppLocalizations l) =>
      [
        MasrafySelectOption(
            value: 'lowest_installment',
            label: l.q_opt_personal_priority_lowest_installment),
        MasrafySelectOption(
            value: 'lowest_interest',
            label: l.q_opt_personal_priority_lowest_interest),
        MasrafySelectOption(
            value: 'minimum_docs',
            label: l.q_opt_personal_priority_minimum_docs),
        MasrafySelectOption(
            value: 'flexible_repayment',
            label: l.q_opt_personal_priority_flexible_repayment),
      ];
}
