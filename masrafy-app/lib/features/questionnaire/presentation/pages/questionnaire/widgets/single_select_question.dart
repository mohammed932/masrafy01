part of '../questionnaire.imports.dart';

/// Single-select question rendered as a labelled radio group. Selecting
/// an option dispatches `updateField(answer, (...))` to the cubit.
class SingleSelectQuestion extends StatelessWidget {
  const SingleSelectQuestion({super.key, required this.question});

  final QuestionEntity question;

  @override
  Widget build(BuildContext context) {
    final textTheme = MasrafyTextTheme.of(context);
    final colors = MasrafyColorTheme.of(context);
    final isRtl = context.isRtl;
    final helper = isRtl ? question.helperTextAr : question.helperTextEn;
    final options = [...question.options]
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

    return BlocBuilder<QuestionnaireCubit, QuestionnaireState>(
      buildWhen: (a, b) => a.answers[question.code] != b.answers[question.code],
      builder: (ctx, state) {
        final selected = state.answers[question.code];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isRtl ? question.questionAr : question.questionEn,
              style: textTheme.body.semiBold().copyWith(color: colors.text.primary),
            ),
            if (helper != null && helper.isNotEmpty) ...[
              const Gap(4),
              Text(
                helper,
                style: textTheme.bodySmall.copyWith(color: colors.text.secondary),
              ),
            ],
            const Gap(8),
            for (final option in options)
              RadioListTile<String>(
                contentPadding: EdgeInsetsDirectional.zero,
                dense: true,
                value: option.code,
                groupValue: selected,
                title: Text(
                  isRtl ? option.labelAr : option.labelEn,
                  style: textTheme.body.copyWith(color: colors.text.primary),
                ),
                onChanged: (value) {
                  if (value == null) return;
                  ctx.read<QuestionnaireCubit>().updateField(
                        QuestionnaireField.answer,
                        (questionCode: question.code, optionCode: value),
                      );
                },
              ),
          ],
        );
      },
    );
  }
}
