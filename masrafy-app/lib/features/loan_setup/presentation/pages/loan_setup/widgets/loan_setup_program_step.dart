import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/cards/masrafy_choice_card.dart';
import 'package:app/features/loan_setup/presentation/pages/loan_setup/cubit/loan_setup/loan_setup_cubit.dart';
import 'package:app/features/loan_setup/presentation/pages/loan_setup/loan_setup_labels.dart';
import 'package:app/features/loan_setup/presentation/pages/loan_setup/widgets/loan_setup_stagger.dart';
import 'package:app/features/loan_setup/presentation/pages/loan_setup/widgets/loan_setup_step_scaffold.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// Step 3 — which catalog program the customer is asking about.
///
/// The list is the names that have at least one ACTIVE bank program under BOTH
/// earlier choices, which is why it could not be shown on Home: a name sold only
/// against a payslip has no business appearing to someone who just said they have
/// none, and the old screen could not know that because it read the catalog's
/// assignment rather than the banks' programs.
///
/// An empty list is a real state, not an error: the basis has programs, but every
/// one of them predates the catalog and instantiates no archetype. The step says
/// so and lets the customer through — the request then goes out narrowed by
/// category + basis, which is still correct.
class LoanSetupProgramStep extends StatelessWidget {
  const LoanSetupProgramStep({super.key, required this.state});

  final LoanSetupState state;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final cubit = context.read<LoanSetupCubit>();
    final isArabic = l.localeName.startsWith('ar');
    final programs = state.programsForSelection;

    return LoanSetupStepScaffold(
      title: l.loan_setup_step_program_title,
      subtitle: breadcrumb(l, state.category, state.incomeType),
      stepIndex: state.stepIndex,
      totalSteps: state.totalSteps,
      onBack: () => cubit.back(),
      heading: l.loan_setup_step_program_heading,
      helper: programs.isEmpty ? null : l.loan_setup_step_program_helper,
      child: programs.isEmpty
          ? Text(
              l.loan_setup_no_programs,
              style: text.body.regular().copyWith(color: colors.text.secondary),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < programs.length; i++) ...[
                  if (i > 0) Gap(12.h),
                  LoanSetupStagger(
                    index: i,
                    child: MasrafyChoiceCard(
                      title: programs[i].label(isArabic: isArabic),
                      trailingLabel:
                          l.loan_setup_bank_count(programs[i].programCount),
                      selected: state.programKey == programs[i].key,
                      onTap: () => cubit.selectProgram(programs[i].key),
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}
