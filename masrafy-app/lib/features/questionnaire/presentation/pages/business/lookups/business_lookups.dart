import 'package:app/core/widgets/input_controls/masrafy_expandable_select.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// Local, static option lists for the business-loan questionnaire dropdowns
/// ("add lookups for now" — no backend questionnaire call this iteration).
///
/// Each option's `value` is a stable, language-neutral id that maps to the
/// backend business `QuestionOption.code`; the `label` is localized at call
/// time. Mirrors [MortgageLookups].
class BusinessLookups {
  BusinessLookups._();

  static List<MasrafySelectOption<bool>> yesNo(AppLocalizations l) => [
        MasrafySelectOption(value: true, label: l.q_common_yes),
        MasrafySelectOption(value: false, label: l.q_common_no),
      ];

  static List<MasrafySelectOption<String>> activityTypes(AppLocalizations l) =>
      [
        MasrafySelectOption(value: 'trade', label: l.q_opt_biz_activity_trade),
        MasrafySelectOption(
            value: 'services', label: l.q_opt_biz_activity_services),
        MasrafySelectOption(value: 'food', label: l.q_opt_biz_activity_food),
        MasrafySelectOption(
            value: 'manufacturing',
            label: l.q_opt_biz_activity_manufacturing),
        MasrafySelectOption(
            value: 'technology', label: l.q_opt_biz_activity_technology),
        MasrafySelectOption(value: 'other', label: l.q_opt_biz_activity_other),
      ];

  static List<MasrafySelectOption<String>> financingPurposes(
          AppLocalizations l) =>
      [
        MasrafySelectOption(
            value: 'expansion', label: l.q_opt_biz_purpose_expansion),
        MasrafySelectOption(
            value: 'equipment', label: l.q_opt_biz_purpose_equipment),
        MasrafySelectOption(
            value: 'working_capital',
            label: l.q_opt_biz_purpose_working_capital),
        MasrafySelectOption(
            value: 'new_branch', label: l.q_opt_biz_purpose_new_branch),
        MasrafySelectOption(
            value: 'settle_obligations',
            label: l.q_opt_biz_purpose_settle_obligations),
        MasrafySelectOption(value: 'other', label: l.q_opt_biz_purpose_other),
      ];

  /// Yes / No / Registration in Progress (three-state, unlike the bool selects).
  static List<MasrafySelectOption<String>> registrationStates(
          AppLocalizations l) =>
      [
        MasrafySelectOption(value: 'yes', label: l.q_common_yes),
        MasrafySelectOption(value: 'no', label: l.q_common_no),
        MasrafySelectOption(
            value: 'in_progress', label: l.q_opt_biz_registration_in_progress),
      ];

  static List<MasrafySelectOption<String>> priorityFactors(
          AppLocalizations l) =>
      [
        MasrafySelectOption(
            value: 'fastest_approval',
            label: l.q_opt_biz_priority_fast_approval),
        MasrafySelectOption(
            value: 'flexible_repayment',
            label: l.q_opt_biz_priority_flexible_repayment),
        MasrafySelectOption(
            value: 'highest_amount',
            label: l.q_opt_biz_priority_highest_amount),
        MasrafySelectOption(
            value: 'lowest_interest',
            label: l.q_opt_biz_priority_lowest_interest),
        MasrafySelectOption(
            value: 'least_paperwork',
            label: l.q_opt_biz_priority_least_paperwork),
      ];
}
