import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/input_controls/masrafy_select_field.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../cubit/mortgage_questionnaire/mortgage_questionnaire_cubit.dart';
import '../lookups/mortgage_lookups.dart';
import 'mortgage_step_scaffold.dart';

/// Step 4 body — Preferences (Figma `4024:3928`). Priority factor select and a
/// document-assistance Yes/No. Flow-local (Principle XXXII); UI-only.
class MortgageStepPreferences extends StatelessWidget {
  const MortgageStepPreferences({super.key, required this.state});

  final MortgageQuestionnaireState state;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<MortgageQuestionnaireCubit>();

    return MortgageStepScaffold(
      title: l.q_mortgage_step4_title,
      stepIndex: 3,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasrafySelectField<String>(
            label: l.q_mortgage_q_priority,
            hint: l.q_mortgage_select_hint,
            options: MortgageLookups.priorityFactors(l),
            value: state.priorityFactor,
            onSelected: (v) =>
                cubit.updateField(MortgageField.priorityFactor, v),
          ),
          Gap(20.h),
          MasrafySelectField<bool>(
            label: l.q_mortgage_q_assistance,
            hint: l.q_mortgage_select_hint,
            options: MortgageLookups.yesNo(l),
            value: state.needsAssistance,
            onSelected: (v) =>
                cubit.updateField(MortgageField.needsAssistance, v),
          ),
        ],
      ),
    );
  }
}
