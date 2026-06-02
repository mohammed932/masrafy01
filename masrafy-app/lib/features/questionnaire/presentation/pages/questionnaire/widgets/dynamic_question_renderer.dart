part of '../questionnaire.imports.dart';

/// Maps a [QuestionEntity]'s `type` to its concrete renderer. Exhaustive
/// switch over [QuestionType] — `unknown` renders nothing so a new
/// backend type degrades gracefully instead of crashing.
class DynamicQuestionRenderer extends StatelessWidget {
  const DynamicQuestionRenderer({super.key, required this.question});

  final QuestionEntity question;

  @override
  Widget build(BuildContext context) {
    switch (question.type) {
      case QuestionType.singleSelect:
        return SingleSelectQuestion(question: question);
      case QuestionType.unknown:
        return const SizedBox.shrink();
    }
  }
}
