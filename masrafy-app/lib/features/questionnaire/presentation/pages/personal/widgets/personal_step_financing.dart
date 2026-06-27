import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/input_controls/masrafy_labeled_field.dart';
import 'package:app/core/widgets/input_controls/masrafy_select_field.dart';
import 'package:app/core/widgets/sliders/masrafy_value_slider.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../cubit/personal_questionnaire/personal_questionnaire_cubit.dart';
import '../lookups/personal_lookups.dart';
import 'personal_step_scaffold.dart';

/// Step 1 body — Financing Details (Figma `4024:2442`). Requested amount
/// (digits only), a repayment-years slider (2–10), and the loan-purpose select.
/// Stateful to own the amount [TextEditingController]. Flow-local (Principle
/// XXXII); UI-only.
class PersonalStepFinancing extends StatefulWidget {
  const PersonalStepFinancing({super.key, required this.state});

  final PersonalQuestionnaireState state;

  @override
  State<PersonalStepFinancing> createState() => _PersonalStepFinancingState();
}

class _PersonalStepFinancingState extends State<PersonalStepFinancing> {
  late final TextEditingController _amount =
      TextEditingController(text: widget.state.loanAmount);

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<PersonalQuestionnaireCubit>();
    final state = widget.state;

    return PersonalStepScaffold(
      title: l.q_personal_step1_title,
      stepIndex: 0,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasrafyLabeledField(
            label: l.q_personal_q_amount,
            hint: l.q_personal_amount_hint,
            controller: _amount,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (v) =>
                cubit.updateField(PersonalField.loanAmount, v),
          ),
          Gap(20.h),
          MasrafyValueSlider(
            label: l.q_personal_repayment_label,
            value: state.repaymentPeriod,
            min: 2,
            max: 10,
            divisions: 8,
            valueLabelBuilder: (v) => l.q_personal_years(v.toInt()),
            minLabel: l.q_personal_years(2),
            maxLabel: l.q_personal_years(10),
            onChanged: (v) =>
                cubit.updateField(PersonalField.repaymentPeriod, v),
          ),
          Gap(20.h),
          MasrafySelectField<String>(
            label: l.q_personal_q_purpose,
            hint: l.q_personal_hint_purpose,
            options: PersonalLookups.loanPurposes(l),
            value: state.loanPurpose,
            onSelected: (v) =>
                cubit.updateField(PersonalField.loanPurpose, v),
          ),
        ],
      ),
    );
  }
}
