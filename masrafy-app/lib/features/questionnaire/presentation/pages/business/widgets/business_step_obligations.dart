import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/input_controls/masrafy_expandable_select.dart';
import 'package:app/core/widgets/input_controls/masrafy_labeled_field.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../cubit/business_questionnaire/business_questionnaire_cubit.dart';
import '../lookups/business_lookups.dart';
import 'business_step_scaffold.dart';

/// Step 3 body — Obligations & Credit Status (Figma `4024:3836`). Current
/// facilities Yes/No, total monthly obligations (digits only), and prior-
/// rejection Yes/No. Stateful to own the obligations [TextEditingController].
/// Flow-local (Principle XXXII); UI-only.
class BusinessStepObligations extends StatefulWidget {
  const BusinessStepObligations({super.key, required this.state});

  final BusinessQuestionnaireState state;

  @override
  State<BusinessStepObligations> createState() =>
      _BusinessStepObligationsState();
}

class _BusinessStepObligationsState extends State<BusinessStepObligations> {
  late final TextEditingController _installments =
      TextEditingController(text: widget.state.currentInstallments);

  @override
  void dispose() {
    _installments.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<BusinessQuestionnaireCubit>();
    final state = widget.state;

    return BusinessStepScaffold(
      title: l.q_business_step3_title,
      stepIndex: 2,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasrafyExpandableSelect<bool>(
            label: l.q_business_q_current_facilities,
            hint: l.q_business_select_hint,
            options: BusinessLookups.yesNo(l),
            value: state.currentFacilities,
            expanded: state.openField == BusinessField.currentFacilities,
            onToggle: () => cubit.toggleField(BusinessField.currentFacilities),
            onSelected: (v) =>
                cubit.updateField(BusinessField.currentFacilities, v),
          ),
          Gap(20.h),
          MasrafyLabeledField(
            label: l.q_business_installments_label,
            hint: l.q_business_installments_hint,
            controller: _installments,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (v) =>
                cubit.updateField(BusinessField.currentInstallments, v),
          ),
          Gap(20.h),
          MasrafyExpandableSelect<bool>(
            label: l.q_business_q_prior_rejection,
            hint: l.q_business_select_hint,
            options: BusinessLookups.yesNo(l),
            value: state.priorRejection,
            expanded: state.openField == BusinessField.priorRejection,
            onToggle: () => cubit.toggleField(BusinessField.priorRejection),
            onSelected: (v) =>
                cubit.updateField(BusinessField.priorRejection, v),
          ),
        ],
      ),
    );
  }
}
