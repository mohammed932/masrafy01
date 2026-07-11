import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';

import 'package:app/features/questionnaire/domain/enums/loan_category.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_cubit.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_view.dart';
import 'package:app/features/questionnaire/presentation/pages/car/car_apply_mapper.dart';

/// Car-loan questionnaire route — a thin wrapper (Principle XXXVI) over the
/// shared backend-driven [QuestionnaireView]. It loads + renders the car
/// snapshot and maps the picked answers to the apply request via
/// [mapCarAnswersToApplyRequest]. The route name `CarQuestionnaireRoute` is
/// unchanged, so existing navigation and `router.gr.dart` stay valid.
@RoutePage()
class CarQuestionnairePage extends StatelessWidget {
  const CarQuestionnairePage({super.key});

  @override
  Widget build(BuildContext context) {
    return QuestionnaireView(
      category: LoanCategory.car,
      buildRequest: (QuestionnaireState state) => mapCarAnswersToApplyRequest(
        state.visibleAnswers,
        versionNumber: state.snapshot?.versionNumber,
      ),
    );
  }
}
