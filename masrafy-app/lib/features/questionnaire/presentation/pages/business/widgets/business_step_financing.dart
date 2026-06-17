import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/input_controls/masrafy_expandable_select.dart';
import 'package:app/core/widgets/input_controls/masrafy_labeled_field.dart';
import 'package:app/core/widgets/sliders/masrafy_value_slider.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../cubit/business_questionnaire/business_questionnaire_cubit.dart';
import '../lookups/business_lookups.dart';
import 'business_step_scaffold.dart';

/// Step 1 body — Business & Financing Details (Figma `4024:2741`). Activity
/// type select, business-age and financing-amount free-text (digits), financing
/// purpose select, and a repayment-years slider. Stateful to own the two
/// [TextEditingController]s; selects are driven by the cubit (`openField` +
/// `updateField`). Flow-local widget (Principle XXXII); UI-only.
class BusinessStepFinancing extends StatefulWidget {
  const BusinessStepFinancing({super.key, required this.state});

  final BusinessQuestionnaireState state;

  @override
  State<BusinessStepFinancing> createState() => _BusinessStepFinancingState();
}

class _BusinessStepFinancingState extends State<BusinessStepFinancing> {
  late final TextEditingController _businessAge =
      TextEditingController(text: widget.state.businessAge);
  late final TextEditingController _financingAmount =
      TextEditingController(text: widget.state.financingAmount);

  @override
  void dispose() {
    _businessAge.dispose();
    _financingAmount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<BusinessQuestionnaireCubit>();
    final state = widget.state;

    return BusinessStepScaffold(
      title: l.q_business_step1_title,
      stepIndex: 0,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasrafyExpandableSelect<String>(
            label: l.q_business_q_activity,
            hint: l.q_business_hint_activity,
            options: BusinessLookups.activityTypes(l),
            value: state.activityType,
            expanded: state.openField == BusinessField.activityType,
            onToggle: () => cubit.toggleField(BusinessField.activityType),
            onSelected: (v) =>
                cubit.updateField(BusinessField.activityType, v),
          ),
          Gap(20.h),
          MasrafyLabeledField(
            label: l.q_business_q_business_age,
            hint: l.q_business_business_age_hint,
            controller: _businessAge,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (v) => cubit.updateField(BusinessField.businessAge, v),
          ),
          Gap(20.h),
          MasrafyLabeledField(
            label: l.q_business_q_financing_amount,
            hint: l.q_business_financing_amount_hint,
            controller: _financingAmount,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (v) =>
                cubit.updateField(BusinessField.financingAmount, v),
          ),
          Gap(20.h),
          MasrafyExpandableSelect<String>(
            label: l.q_business_q_purpose,
            hint: l.q_business_hint_purpose,
            options: BusinessLookups.financingPurposes(l),
            value: state.financingPurpose,
            expanded: state.openField == BusinessField.financingPurpose,
            onToggle: () => cubit.toggleField(BusinessField.financingPurpose),
            onSelected: (v) =>
                cubit.updateField(BusinessField.financingPurpose, v),
          ),
          Gap(20.h),
          MasrafyValueSlider(
            label: l.q_business_repayment_label,
            value: state.repaymentPeriod,
            min: 2,
            max: 10,
            divisions: 8,
            valueLabelBuilder: (v) => l.q_business_years(v.toInt()),
            minLabel: l.q_business_years(2),
            maxLabel: l.q_business_years(10),
            onChanged: (v) =>
                cubit.updateField(BusinessField.repaymentPeriod, v),
          ),
        ],
      ),
    );
  }
}
