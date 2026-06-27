import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/input_controls/masrafy_select_field.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../cubit/car_questionnaire/car_questionnaire_cubit.dart';
import '../lookups/car_lookups.dart';
import 'car_step_scaffold.dart';

/// Step 4 body — Preferences (Figma `4024:4023`). Priority-factor select and a
/// vehicle-insurance Yes/No. Flow-local (Principle XXXII); UI-only.
class CarStepPreferences extends StatelessWidget {
  const CarStepPreferences({super.key, required this.state});

  final CarQuestionnaireState state;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<CarQuestionnaireCubit>();

    return CarStepScaffold(
      title: l.q_car_step4_title,
      stepIndex: 3,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasrafySelectField<String>(
            label: l.q_car_q_priority,
            hint: l.q_car_select_hint,
            options: CarLookups.priorityFactors(l),
            value: state.priorityFactor,
            onSelected: (v) =>
                cubit.updateField(CarField.priorityFactor, v),
          ),
          Gap(20.h),
          MasrafySelectField<bool>(
            label: l.q_car_q_insurance,
            hint: l.q_car_select_hint,
            options: CarLookups.yesNo(l),
            value: state.wantsInsurance,
            onSelected: (v) => cubit.updateField(CarField.wantsInsurance, v),
          ),
        ],
      ),
    );
  }
}
