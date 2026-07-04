import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';

import 'package:app/features/questionnaire/domain/enums/loan_category.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_cubit.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_view.dart';
import 'package:app/features/questionnaire/presentation/pages/personal/personal_apply_mapper.dart';

/// Personal-loan questionnaire route — a thin wrapper (Principle XXXVI) over the
/// shared backend-driven [QuestionnaireView]. It loads + renders the personal
/// snapshot and maps the picked answers to the apply request via
/// [mapPersonalAnswersToApplyRequest]. The route name `PersonalQuestionnaireRoute`
/// is unchanged, so existing navigation and `router.gr.dart` stay valid.
@RoutePage()
class PersonalQuestionnairePage extends StatelessWidget {
  const PersonalQuestionnairePage({super.key});

  @override
  Widget build(BuildContext context) {
    return QuestionnaireView(
      category: LoanCategory.personal,
      buildRequest: (QuestionnaireState state) => mapPersonalAnswersToApplyRequest(
        state.visibleAnswers,
        versionNumber: state.snapshot?.versionNumber,
      ),
    );
  }
}
