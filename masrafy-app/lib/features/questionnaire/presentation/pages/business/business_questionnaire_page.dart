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
  const BusinessQuestionnairePage({super.key});

  @override
  Widget build(BuildContext context) {
    return QuestionnaireView(
      category: LoanCategory.business,
      buildRequest: (QuestionnaireState state) =>
          mapBusinessAnswersToApplyRequest(state.visibleAnswers),
    );
  }
}
