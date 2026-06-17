import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/input_controls/masrafy_expandable_select.dart';
import 'package:app/core/widgets/sliders/masrafy_range_slider.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../cubit/business_questionnaire/business_questionnaire_cubit.dart';
import '../lookups/business_lookups.dart';
import 'business_step_scaffold.dart';

/// Step 2 body — Financial Information (Figma `4024:3359`). An average monthly-
/// revenue range slider, plus business-account, registration-status (three-way)
/// and tax-registration selects. All inline-expand dropdowns driven by the
/// cubit. Flow-local (Principle XXXII); UI-only.
class BusinessStepFinancial extends StatelessWidget {
  const BusinessStepFinancial({super.key, required this.state});

  final BusinessQuestionnaireState state;

  static const double _minRevenue = 100000;
  static const double _maxRevenue = 10000000;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<BusinessQuestionnaireCubit>();

    String egp(double v) => '${l.q_common_currency_egp} ${_compact(v)}';

    return BusinessStepScaffold(
      title: l.q_business_step2_title,
      stepIndex: 1,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasrafyRangeSlider(
            label: l.q_business_q_revenue,
            values: RangeValues(
              state.monthlyRevenueStart,
              state.monthlyRevenueEnd,
            ),
            min: _minRevenue,
            max: _maxRevenue,
            divisions: 99,
            valueLabelBuilder: egp,
            minLabel: egp(_minRevenue),
            maxLabel: egp(_maxRevenue),
            onChanged: (rv) =>
                cubit.updateMonthlyRevenue(start: rv.start, end: rv.end),
          ),
          Gap(20.h),
          MasrafyExpandableSelect<bool>(
            label: l.q_business_q_bank_account,
            hint: l.q_business_select_hint,
            options: BusinessLookups.yesNo(l),
            value: state.businessAccount,
            expanded: state.openField == BusinessField.businessAccount,
            onToggle: () => cubit.toggleField(BusinessField.businessAccount),
            onSelected: (v) =>
                cubit.updateField(BusinessField.businessAccount, v),
          ),
          Gap(20.h),
          MasrafyExpandableSelect<String>(
            label: l.q_business_q_registered,
            hint: l.q_business_select_hint,
            options: BusinessLookups.registrationStates(l),
            value: state.registered,
            expanded: state.openField == BusinessField.registered,
            onToggle: () => cubit.toggleField(BusinessField.registered),
            onSelected: (v) => cubit.updateField(BusinessField.registered, v),
          ),
          Gap(20.h),
          MasrafyExpandableSelect<bool>(
            label: l.q_business_q_tax,
            hint: l.q_business_select_hint,
            options: BusinessLookups.yesNo(l),
            value: state.taxRegistration,
            expanded: state.openField == BusinessField.taxRegistration,
            onToggle: () => cubit.toggleField(BusinessField.taxRegistration),
            onSelected: (v) =>
                cubit.updateField(BusinessField.taxRegistration, v),
          ),
        ],
      ),
    );
  }
}

/// Compact money formatter: 100000 → "100K", 10000000 → "10M".
String _compact(double v) {
  if (v >= 1e6) {
    final m = v / 1e6;
    return '${m == m.roundToDouble() ? m.toInt() : m.toStringAsFixed(1)}M';
  }
  if (v >= 1e3) return '${(v / 1e3).round()}K';
  return v.round().toString();
}
