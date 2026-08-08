import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';

import 'package:app/features/questionnaire/domain/enums/loan_category.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_cubit.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_view.dart';
import 'package:app/features/questionnaire/presentation/pages/mortgage/mortgage_apply_mapper.dart';

/// Mortgage-loan questionnaire route — a thin wrapper (Principle XXXVI) over the
/// shared backend-driven [QuestionnaireView]. It loads + renders the mortgage
/// snapshot and maps the picked answers to the apply request via
/// [mapMortgageAnswersToApplyRequest]. The route name `MortgageQuestionnaireRoute`
/// is unchanged, so existing navigation and `router.gr.dart` stay valid.
@RoutePage()
class MortgageQuestionnairePage extends StatelessWidget {
  const MortgageQuestionnairePage({super.key, this.programNameKey});

  /// Catalog program name picked on Home alongside the loan category; narrows
  /// the matched programs to that archetype. Null = whole category.
  final String? programNameKey;

  @override
  Widget build(BuildContext context) {
    return QuestionnaireView(
      category: LoanCategory.mortgage,
      buildRequest: (QuestionnaireState state) =>
          mapMortgageAnswersToApplyRequest(
        state.visibleAnswers,
        programNameKey: programNameKey,
      ),
    );
  }
}
