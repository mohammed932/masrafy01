import 'package:equatable/equatable.dart';

import 'question_entity.dart';

/// A titled group of questionnaire questions, rendered as one section.
class QuestionGroupEntity extends Equatable {
  const QuestionGroupEntity({
    required this.code,
    required this.titleAr,
    required this.titleEn,
    required this.displayOrder,
    required this.questions,
  });

  final String code;
  final String titleAr;
  final String titleEn;
  final int displayOrder;
  final List<QuestionEntity> questions;

  @override
  List<Object?> get props => [code, displayOrder];
}
