import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/input_controls/masrafy_expandable_select.dart';
import 'package:app/core/widgets/input_controls/masrafy_labeled_field.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../cubit/car_questionnaire/car_questionnaire_cubit.dart';
import '../lookups/car_lookups.dart';
import 'car_step_scaffold.dart';

/// Step 3 body — Financial Status (Figma `4024:3744`). Current obligations
/// Yes/No, total monthly installments (digits only), and active-credit-card
/// Yes/No. Stateful to own the installments [TextEditingController]. Flow-local
/// (Principle XXXII); UI-only.
class CarStepFinancial extends StatefulWidget {
  const CarStepFinancial({super.key, required this.state});

  final CarQuestionnaireState state;

  @override
  State<CarStepFinancial> createState() => _CarStepFinancialState();
}

class _CarStepFinancialState extends State<CarStepFinancial> {
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
    final cubit = context.read<CarQuestionnaireCubit>();
    final state = widget.state;

    return CarStepScaffold(
      title: l.q_car_step3_title,
      stepIndex: 2,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasrafyExpandableSelect<bool>(
            label: l.q_car_q_current_loans,
            hint: l.q_car_select_hint,
            options: CarLookups.yesNo(l),
            value: state.currentLoans,
            expanded: state.openField == CarField.currentLoans,
            onToggle: () => cubit.toggleField(CarField.currentLoans),
            onSelected: (v) => cubit.updateField(CarField.currentLoans, v),
          ),
          Gap(20.h),
          MasrafyLabeledField(
            label: l.q_car_installments_label,
            hint: l.q_car_installments_hint,
            controller: _installments,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (v) =>
                cubit.updateField(CarField.currentInstallments, v),
          ),
          Gap(20.h),
          MasrafyExpandableSelect<bool>(
            label: l.q_car_q_credit_card,
            hint: l.q_car_select_hint,
            options: CarLookups.yesNo(l),
            value: state.hasCreditCard,
            expanded: state.openField == CarField.hasCreditCard,
            onToggle: () => cubit.toggleField(CarField.hasCreditCard),
            onSelected: (v) => cubit.updateField(CarField.hasCreditCard, v),
          ),
        ],
      ),
    );
  }
}
