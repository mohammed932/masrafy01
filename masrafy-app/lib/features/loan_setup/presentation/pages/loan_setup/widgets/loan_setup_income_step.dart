import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/cards/masrafy_choice_card.dart';
import 'package:app/features/loan_setup/domain/enums/income_type.dart';
import 'package:app/features/loan_setup/presentation/pages/loan_setup/cubit/loan_setup/loan_setup_cubit.dart';
import 'package:app/features/loan_setup/presentation/pages/loan_setup/loan_setup_labels.dart';
import 'package:app/features/loan_setup/presentation/pages/loan_setup/widgets/loan_setup_stagger.dart';
import 'package:app/features/loan_setup/presentation/pages/loan_setup/widgets/loan_setup_step_scaffold.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// Step 2 — how the bank will work out the applicant's income.
///
/// The customer is choosing a filter over PROGRAMS, not a product: `income_proof`
/// and `income_surrogate` are the two values of `bank_program.programType`, which
/// the bank sets on its own program. It is not a fifth loan category and must
/// never be worded as one (Principle II / A26) — hence "with a payslip" rather
/// than "Fast Loans", and hence its place here rather than on the Home grid.
///
/// Both bases always render. One with no live program behind it is shown DISABLED
/// with a reason rather than dropped: a silently shortened list is
/// indistinguishable from a broken screen, and the reason ("no bank offers this
/// without a payslip yet") is the honest answer.
class LoanSetupIncomeStep extends StatelessWidget {
  const LoanSetupIncomeStep({super.key, required this.state});

  final LoanSetupState state;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<LoanSetupCubit>();
    final options = state.incomeTypeOptions;

    return LoanSetupStepScaffold(
      title: l.loan_setup_step_income_title,
      subtitle: categoryLabel(l, state.category),
      stepIndex: state.stepIndex,
      totalSteps: state.totalSteps,
      onBack: () => cubit.back(),
      heading: l.loan_setup_step_income_heading,
      helper: l.loan_setup_step_income_helper,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < options.length; i++) ...[
            if (i > 0) Gap(12.h),
            LoanSetupStagger(
              index: i,
              child: MasrafyChoiceCard(
                title: incomeTypeLabel(l, options[i].programType),
                subtitle: incomeTypeDescription(l, options[i].programType),
                icon: _iconOf(options[i].programType),
                trailingLabel: l.loan_setup_bank_count(options[i].programCount),
                enabled: options[i].isAvailable,
                disabledNote: l.loan_setup_income_unavailable,
                selected: state.incomeType == options[i].programType,
                onTap: () => cubit.selectIncomeType(options[i].programType),
              ),
            ),
          ],
        ],
      ),
    );
  }

  IconData _iconOf(IncomeType type) => switch (type) {
        IncomeType.incomeProof => Icons.receipt_long_rounded,
        IncomeType.incomeSurrogate => Icons.workspace_premium_rounded,
      };
}
