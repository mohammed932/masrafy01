import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/input_controls/masrafy_select_field.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../cubit/personal_questionnaire/personal_questionnaire_cubit.dart';
import '../lookups/personal_lookups.dart';
import 'personal_step_scaffold.dart';

/// Step 2 body — Employment & Income (Figma `4024:3049`). Employment status,
/// job tenure, monthly-income band, salary-transfer Yes/No, and employer-
/// approved select. All driven by the cubit (`updateField`). Flow-local
/// (Principle XXXII); UI-only.
class PersonalStepEmployment extends StatelessWidget {
  const PersonalStepEmployment({super.key, required this.state});

  final PersonalQuestionnaireState state;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<PersonalQuestionnaireCubit>();

    return PersonalStepScaffold(
      title: l.q_personal_step2_title,
      stepIndex: 1,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasrafySelectField<String>(
            label: l.q_personal_q_employment,
            hint: l.q_personal_select_hint,
            options: PersonalLookups.employmentStatuses(l),
            value: state.employmentStatus,
            onSelected: (v) =>
                cubit.updateField(PersonalField.employmentStatus, v),
          ),
          Gap(20.h),
          MasrafySelectField<String>(
            label: l.q_personal_q_job_tenure,
            hint: l.q_personal_hint_job_tenure,
            options: PersonalLookups.jobTenures(l),
            value: state.jobTenure,
            onSelected: (v) => cubit.updateField(PersonalField.jobTenure, v),
          ),
          Gap(20.h),
          MasrafySelectField<String>(
            label: l.q_personal_q_income,
            hint: l.q_personal_select_hint,
            options: PersonalLookups.incomeBands(l),
            value: state.monthlyIncome,
            onSelected: (v) =>
                cubit.updateField(PersonalField.monthlyIncome, v),
          ),
          Gap(20.h),
          MasrafySelectField<bool>(
            label: l.q_personal_q_salary_transfer,
            hint: l.q_personal_select_hint,
            options: PersonalLookups.yesNo(l),
            value: state.salaryTransfer,
            onSelected: (v) =>
                cubit.updateField(PersonalField.salaryTransfer, v),
          ),
          Gap(20.h),
          MasrafySelectField<String>(
            label: l.q_personal_q_employer_approved,
            hint: l.q_personal_select_hint,
            options: PersonalLookups.employerApproved(l),
            value: state.employerApproved,
            onSelected: (v) =>
                cubit.updateField(PersonalField.employerApproved, v),
          ),
        ],
      ),
    );
  }
}
