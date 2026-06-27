import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/input_controls/masrafy_select_field.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../cubit/business_questionnaire/business_questionnaire_cubit.dart';
import '../lookups/business_lookups.dart';
import 'business_step_scaffold.dart';

/// Step 4 body — Preferences & Support (Figma `4024:4118`). Priority factor
/// select and an expert-consultation Yes/No. Flow-local (Principle XXXII);
/// UI-only.
class BusinessStepPreferences extends StatelessWidget {
  const BusinessStepPreferences({super.key, required this.state});

  final BusinessQuestionnaireState state;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<BusinessQuestionnaireCubit>();

    return BusinessStepScaffold(
      title: l.q_business_step4_title,
      stepIndex: 3,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasrafySelectField<String>(
            label: l.q_business_q_priority,
            hint: l.q_business_select_hint,
            options: BusinessLookups.priorityFactors(l),
            value: state.priorityFactor,
            onSelected: (v) =>
                cubit.updateField(BusinessField.priorityFactor, v),
          ),
          Gap(20.h),
          MasrafySelectField<bool>(
            label: l.q_business_q_consultation,
            hint: l.q_business_select_hint,
            options: BusinessLookups.yesNo(l),
            value: state.needsConsultation,
            onSelected: (v) =>
                cubit.updateField(BusinessField.needsConsultation, v),
          ),
        ],
      ),
    );
  }
}
