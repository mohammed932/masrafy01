import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/input_controls/masrafy_select_field.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../cubit/car_questionnaire/car_questionnaire_cubit.dart';
import '../lookups/car_lookups.dart';
import 'car_step_scaffold.dart';

/// Step 2 body — Employment & Income (Figma `4024:3204`). Employment status,
/// monthly-income band, salary-transfer Yes/No, and employer-approved select.
/// All inline-expand dropdowns driven by the cubit. Flow-local (Principle
/// XXXII); UI-only.
class CarStepEmployment extends StatelessWidget {
  const CarStepEmployment({super.key, required this.state});

  final CarQuestionnaireState state;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<CarQuestionnaireCubit>();

    return CarStepScaffold(
      title: l.q_car_step2_title,
      stepIndex: 1,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasrafySelectField<String>(
            label: l.q_car_q_employment,
            hint: l.q_car_select_hint,
            options: CarLookups.employmentStatuses(l),
            value: state.employmentStatus,
            onSelected: (v) =>
                cubit.updateField(CarField.employmentStatus, v),
          ),
          Gap(20.h),
          MasrafySelectField<String>(
            label: l.q_car_q_income,
            hint: l.q_car_select_hint,
            options: CarLookups.incomeBands(l),
            value: state.monthlyIncome,
            onSelected: (v) => cubit.updateField(CarField.monthlyIncome, v),
          ),
          Gap(20.h),
          MasrafySelectField<bool>(
            label: l.q_car_q_salary_transfer,
            hint: l.q_car_select_hint,
            options: CarLookups.yesNo(l),
            value: state.salaryTransfer,
            onSelected: (v) => cubit.updateField(CarField.salaryTransfer, v),
          ),
          Gap(20.h),
          MasrafySelectField<String>(
            label: l.q_car_q_employer_approved,
            hint: l.q_car_select_hint,
            options: CarLookups.employerApproved(l),
            value: state.employerApproved,
            onSelected: (v) =>
                cubit.updateField(CarField.employerApproved, v),
          ),
        ],
      ),
    );
  }
}
