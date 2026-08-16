import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/utils/masrafy_assets.dart';
import 'package:app/core/widgets/cards/masrafy_choice_card.dart';
import 'package:app/features/loan_setup/presentation/pages/loan_setup/cubit/loan_setup/loan_setup_cubit.dart';
import 'package:app/features/loan_setup/presentation/pages/loan_setup/widgets/loan_setup_stagger.dart';
import 'package:app/features/loan_setup/presentation/pages/loan_setup/widgets/loan_setup_step_scaffold.dart';
import 'package:app/features/questionnaire/domain/enums/loan_category.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// Step 1 — what is being financed.
///
/// Arrives pre-answered from Home, so this step exists to be REVISED rather than
/// filled in: the customer who realises on step 2 that they meant a car loan can
/// walk back one screen instead of losing the route. Changing it here clears the
/// two later answers, because both were picked from lists this category does not
/// produce.
class LoanSetupCategoryStep extends StatelessWidget {
  const LoanSetupCategoryStep({super.key, required this.state});

  final LoanSetupState state;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<LoanSetupCubit>();

    final options = <(LoanCategory, String, String)>[
      (LoanCategory.personal, MasrafyAssets.homeIconPersonal, l.home_cat_personal),
      (LoanCategory.mortgage, MasrafyAssets.homeIconMortgage, l.home_cat_mortgage),
      (LoanCategory.car, MasrafyAssets.homeIconCar, l.home_cat_car),
      (LoanCategory.business, MasrafyAssets.homeIconBusiness, l.home_cat_business),
    ];

    return LoanSetupStepScaffold(
      title: l.loan_setup_step_category_title,
      subtitle: l.loan_setup_step_category_subtitle,
      stepIndex: state.stepIndex,
      totalSteps: state.totalSteps,
      onBack: () => Navigator.of(context).maybePop(),
      heading: l.loan_setup_step_category_heading,
      // Said here rather than on a full-screen message: a category no bank
      // currently sells must stay a choice the customer can change, not a wall
      // whose only exit is back to Home. Next stays dead until they pick another.
      helper: state.options != null && !state.hasAnyProgram
          ? l.loan_setup_no_options
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < options.length; i++) ...[
            if (i > 0) Gap(12.h),
            LoanSetupStagger(
              index: i,
              child: MasrafyChoiceCard(
                title: options[i].$3,
                iconAsset: options[i].$2,
                selected: state.category == options[i].$1,
                onTap: () => cubit.selectCategory(options[i].$1),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
