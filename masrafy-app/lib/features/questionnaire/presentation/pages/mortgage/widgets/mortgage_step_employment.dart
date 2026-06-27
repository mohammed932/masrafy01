import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/input_controls/masrafy_select_field.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../cubit/mortgage_questionnaire/mortgage_questionnaire_cubit.dart';
import '../lookups/mortgage_lookups.dart';
import 'mortgage_step_scaffold.dart';

/// Step 2 body — Employment & Income (Figma `4024:2914`). Employment status,
/// monthly-income band, salary-transfer and additional-income Yes/No selects.
/// All inline-expand dropdowns driven by the cubit. Flow-local (Principle
/// XXXII); UI-only.
class MortgageStepEmployment extends StatelessWidget {
  const MortgageStepEmployment({super.key, required this.state});

  final MortgageQuestionnaireState state;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<MortgageQuestionnaireCubit>();

    return MortgageStepScaffold(
      title: l.q_mortgage_step2_title,
      stepIndex: 1,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasrafySelectField<String>(
            label: l.q_mortgage_q_employment,
            hint: l.q_mortgage_select_hint,
            options: MortgageLookups.employmentStatuses(l),
            value: state.employmentStatus,
            onSelected: (v) =>
                cubit.updateField(MortgageField.employmentStatus, v),
          ),
          Gap(20.h),
          MasrafySelectField<String>(
            label: l.q_mortgage_q_income,
            hint: l.q_mortgage_hint_income,
            options: MortgageLookups.incomeBands(l),
            value: state.monthlyIncome,
            onSelected: (v) =>
                cubit.updateField(MortgageField.monthlyIncome, v),
          ),
          Gap(20.h),
          MasrafySelectField<bool>(
            label: l.q_mortgage_q_salary_transfer,
            hint: l.q_mortgage_select_hint,
            options: MortgageLookups.yesNo(l),
            value: state.salaryTransfer,
            onSelected: (v) =>
                cubit.updateField(MortgageField.salaryTransfer, v),
          ),
          Gap(20.h),
          MasrafySelectField<bool>(
            label: l.q_mortgage_q_additional_income,
            hint: l.q_mortgage_select_hint,
            options: MortgageLookups.yesNo(l),
            value: state.additionalIncome,
            onSelected: (v) =>
                cubit.updateField(MortgageField.additionalIncome, v),
          ),
        ],
      ),
    );
  }
}
