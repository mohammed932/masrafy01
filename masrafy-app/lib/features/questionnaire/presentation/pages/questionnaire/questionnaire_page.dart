part of 'questionnaire.imports.dart';

/// Feature-009 root. Provides [QuestionnaireCubit] and switches the
/// visible screen on `state.step` — questionnaire form vs matching
/// preview. Single public route-level widget (Constitution XXXVI).
@RoutePage()
class QuestionnairePage extends StatelessWidget {
  const QuestionnairePage({super.key, this.category = LoanCategory.personal});

  final LoanCategory category;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<QuestionnaireCubit>(
      create: (_) => getIt<QuestionnaireCubit>()..loadQuestionnaire(category),
      child: const _QuestionnaireView(),
    );
  }
}

class _QuestionnaireView extends StatelessWidget {
  const _QuestionnaireView();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<QuestionnaireCubit, QuestionnaireState>(
      buildWhen: (a, b) => a.step != b.step,
      builder: (context, state) {
        switch (state.step) {
          case QuestionnaireStep.idle:
          case QuestionnaireStep.loadingQuestionnaire:
          case QuestionnaireStep.questionnaireReady:
            return const QuestionnaireFormPage();
          case QuestionnaireStep.submittingPreview:
          case QuestionnaireStep.previewReady:
            return const MatchingPreviewPage();
        }
      },
    );
  }
}
