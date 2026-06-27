import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/input_controls/masrafy_labeled_field.dart';
import 'package:app/core/widgets/input_controls/masrafy_multi_select_field.dart';
import 'package:app/core/widgets/input_controls/masrafy_select_field.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../cubit/personal_questionnaire/personal_questionnaire_cubit.dart';
import '../lookups/personal_lookups.dart';
import 'personal_step_scaffold.dart';

/// Step 3 body — Banking Commitments (Figma `4024:3620`). Multi-select
/// obligations, total monthly installment (digits only), an active-credit-card
/// Yes/No, and a conditional credit-card-usage band. Stateful to own the
/// installment [TextEditingController]. Flow-local (Principle XXXII); UI-only.
class PersonalStepCommitments extends StatefulWidget {
  const PersonalStepCommitments({super.key, required this.state});

  final PersonalQuestionnaireState state;

  @override
  State<PersonalStepCommitments> createState() =>
      _PersonalStepCommitmentsState();
}

class _PersonalStepCommitmentsState extends State<PersonalStepCommitments> {
  late final TextEditingController _installment =
      TextEditingController(text: widget.state.monthlyInstallment);

  @override
  void dispose() {
    _installment.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<PersonalQuestionnaireCubit>();
    final state = widget.state;

    return PersonalStepScaffold(
      title: l.q_personal_step3_title,
      stepIndex: 2,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasrafyMultiSelectField<String>(
            label: l.q_personal_q_obligations,
            hint: l.q_personal_hint_obligations,
            options: PersonalLookups.obligationTypes(l),
            values: state.obligations,
            applyLabel: l.q_common_save,
            cancelLabel: l.q_common_cancel,
            searchHint: l.q_common_search,
            onChanged: (v) =>
                cubit.updateField(PersonalField.obligations, v),
          ),
          Gap(20.h),
          MasrafyLabeledField(
            label: l.q_personal_q_installment,
            hint: l.q_personal_installment_hint,
            controller: _installment,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (v) =>
                cubit.updateField(PersonalField.monthlyInstallment, v),
          ),
          Gap(20.h),
          MasrafySelectField<bool>(
            label: l.q_personal_q_credit_card,
            hint: l.q_personal_select_hint,
            options: PersonalLookups.yesNo(l),
            value: state.hasCreditCard,
            onSelected: (v) =>
                cubit.updateField(PersonalField.hasCreditCard, v),
          ),
          if (state.hasCreditCard == true) ...[
            Gap(20.h),
            MasrafySelectField<String>(
              label: l.q_personal_q_credit_card_usage,
              hint: l.q_personal_select_hint,
              options: PersonalLookups.creditCardUsageBands(l),
              value: state.creditCardUsage,
              onSelected: (v) =>
                  cubit.updateField(PersonalField.creditCardUsage, v),
            ),
          ],
        ],
      ),
    );
  }
}
