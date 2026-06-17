import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/input_controls/masrafy_expandable_select.dart';
import 'package:app/core/widgets/input_controls/masrafy_labeled_field.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../cubit/mortgage_questionnaire/mortgage_questionnaire_cubit.dart';
import '../lookups/mortgage_lookups.dart';
import 'mortgage_step_scaffold.dart';

/// Step 3 body — Credit Profile (Figma `4024:3528`). Current obligations
/// Yes/No, total monthly installments (digits only), and prior-rejection
/// Yes/No. Stateful to own the installments [TextEditingController]. Flow-local
/// (Principle XXXII); UI-only.
class MortgageStepCredit extends StatefulWidget {
  const MortgageStepCredit({super.key, required this.state});

  final MortgageQuestionnaireState state;

  @override
  State<MortgageStepCredit> createState() => _MortgageStepCreditState();
}

class _MortgageStepCreditState extends State<MortgageStepCredit> {
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
    final cubit = context.read<MortgageQuestionnaireCubit>();
    final state = widget.state;

    return MortgageStepScaffold(
      title: l.q_mortgage_step3_title,
      stepIndex: 2,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasrafyExpandableSelect<bool>(
            label: l.q_mortgage_q_current_loans,
            hint: l.q_mortgage_select_hint,
            options: MortgageLookups.yesNo(l),
            value: state.currentLoans,
            expanded: state.openField == MortgageField.currentLoans,
            onToggle: () => cubit.toggleField(MortgageField.currentLoans),
            onSelected: (v) => cubit.updateField(MortgageField.currentLoans, v),
          ),
          Gap(20.h),
          MasrafyLabeledField(
            label: l.q_mortgage_installments_label,
            hint: l.q_mortgage_installments_hint,
            controller: _installments,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (v) =>
                cubit.updateField(MortgageField.currentInstallments, v),
          ),
          Gap(20.h),
          MasrafyExpandableSelect<bool>(
            label: l.q_mortgage_q_prior_rejection,
            hint: l.q_mortgage_select_hint,
            options: MortgageLookups.yesNo(l),
            value: state.priorRejection,
            expanded: state.openField == MortgageField.priorRejection,
            onToggle: () => cubit.toggleField(MortgageField.priorRejection),
            onSelected: (v) =>
                cubit.updateField(MortgageField.priorRejection, v),
          ),
        ],
      ),
    );
  }
}
