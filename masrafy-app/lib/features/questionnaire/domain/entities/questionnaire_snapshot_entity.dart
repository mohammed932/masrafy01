import 'package:equatable/equatable.dart';

import 'question_entity.dart';
import 'question_group_entity.dart';

/// Published questionnaire snapshot for one loan category. `allQuestions`
/// flattens the groups so the cubit can evaluate `enabledWhen` rules and
/// the required-answer gate across the whole form.
class QuestionnaireSnapshotEntity extends Equatable {
  const QuestionnaireSnapshotEntity({
    required this.category,
    required this.versionNumber,
    required this.groups,
  });

  final String category;
  final int versionNumber;
  final List<QuestionGroupEntity> groups;

  List<QuestionEntity> get allQuestions =>
      groups.expand((g) => g.questions).toList();

  @override
  List<Object?> get props => [category, versionNumber];
}
