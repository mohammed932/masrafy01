part of '../questionnaire.imports.dart';

/// Renders one question group: a section title plus each currently
/// visible question (visibility decided by the cubit's `enabledWhen`
/// evaluation on the live answer map).
class QuestionGroupSection extends StatelessWidget {
  const QuestionGroupSection({super.key, required this.group});

  final QuestionGroupEntity group;

  @override
  Widget build(BuildContext context) {
    final textTheme = MasrafyTextTheme.of(context);
    final colors = MasrafyColorTheme.of(context);
    final isRtl = context.isRtl;
    final questions = [...group.questions]
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

    return BlocBuilder<QuestionnaireCubit, QuestionnaireState>(
      buildWhen: (a, b) => a.answers != b.answers,
      builder: (ctx, state) {
        final visible =
            questions.where(state.isQuestionVisible).toList(growable: false);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isRtl ? group.titleAr : group.titleEn,
              style: textTheme.heading5.copyWith(color: colors.text.primary),
            ),
            const Gap(12),
            for (final question in visible) ...[
              DynamicQuestionRenderer(question: question),
              const Gap(16),
            ],
          ],
        );
      },
    );
  }
}
