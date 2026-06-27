import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/input_controls/masrafy_select_field.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../cubit/personal_questionnaire/personal_questionnaire_cubit.dart';
import '../lookups/personal_lookups.dart';
import 'personal_step_scaffold.dart';

/// Step 4 body — Preferences & Qualifications (Figma `4024:4213`). Priority-
/// factor select, a prior-rejection Yes/No, and a needs-assistance Yes/No.
/// Flow-local (Principle XXXII); UI-only.
class PersonalStepPreferences extends StatelessWidget {
  const PersonalStepPreferences({super.key, required this.state});

  final PersonalQuestionnaireState state;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<PersonalQuestionnaireCubit>();

    return PersonalStepScaffold(
      title: l.q_personal_step4_title,
      stepIndex: 3,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasrafySelectField<String>(
            label: l.q_personal_q_priority,
            hint: l.q_personal_select_hint,
            options: PersonalLookups.priorityFactors(l),
            value: state.priorityFactor,
            onSelected: (v) =>
                cubit.updateField(PersonalField.priorityFactor, v),
          ),
          Gap(20.h),
          MasrafySelectField<bool>(
            label: l.q_personal_q_prior_rejection,
            hint: l.q_personal_select_hint,
            options: PersonalLookups.yesNo(l),
            value: state.previouslyRejected,
            onSelected: (v) =>
                cubit.updateField(PersonalField.previouslyRejected, v),
          ),
          Gap(20.h),
          MasrafySelectField<bool>(
            label: l.q_personal_q_assistance,
            hint: l.q_personal_select_hint,
            options: PersonalLookups.yesNo(l),
            value: state.needsAssistance,
            onSelected: (v) =>
                cubit.updateField(PersonalField.needsAssistance, v),
          ),
        ],
      ),
    );
  }
}
