import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';

import 'package:app/features/questionnaire/domain/enums/loan_category.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_cubit.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_view.dart';
import 'package:app/features/questionnaire/presentation/pages/business/business_apply_mapper.dart';

/// Business-loan questionnaire route — a thin wrapper (Principle XXXVI) over the
/// shared backend-driven [QuestionnaireView]. It loads + renders the business
/// snapshot and maps the picked answers to the apply request via
/// [mapBusinessAnswersToApplyRequest]. The route name `BusinessQuestionnaireRoute`
/// is unchanged, so existing navigation and `router.gr.dart` stay valid.
@RoutePage()
class BusinessQuestionnairePage extends StatelessWidget {
  const BusinessQuestionnairePage({
    super.key,
    this.programNameKey,
    this.incomeType,
  });

  /// Catalog program name picked in the loan-setup wizard alongside the loan
  /// category; narrows the matched programs to that archetype. Null = whole
  /// category.
  final String? programNameKey;

  /// The income basis picked in the loan-setup wizard (`income_proof` /
  /// `income_surrogate`), carried straight through to the apply request where it
  /// narrows the matched programs to banks that work the income out that way.
  /// Null = both bases, which is what older builds sent.
  final String? incomeType;

  @override
  Widget build(BuildContext context) {
    return QuestionnaireView(
      category: LoanCategory.business,
      // The picked program decides WHICH questions are served, not only which programs
      // are matched at apply. Forwarded here as well as into the mapper below.
      programNameKey: programNameKey,
      buildRequest: (QuestionnaireState state) =>
          mapBusinessAnswersToApplyRequest(
        state.visibleAnswers,
        programNameKey: programNameKey,
        programType: incomeType,
      ),
    );
  }
}
