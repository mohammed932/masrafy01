import 'package:equatable/equatable.dart';

import '../enums/question_type.dart';
import 'question_enabled_when_entity.dart';
import 'question_option_entity.dart';

/// A single questionnaire question. `enabledWhen` drives conditional
/// visibility; `options` are the selectable answers (already ordered).
class QuestionEntity extends Equatable {
  const QuestionEntity({
    required this.code,
    required this.type,
    required this.questionAr,
    required this.questionEn,
    required this.isRequired,
    required this.displayOrder,
    required this.options,
    this.helperTextAr,
    this.helperTextEn,
    this.enabledWhen,
    this.systemRole,
    this.scoringFactorCode,
    this.profileField,
  });

  final String code;
  final QuestionType type;
  final String questionAr;
  final String questionEn;
  final String? helperTextAr;
  final String? helperTextEn;
  final bool isRequired;
  final int displayOrder;
  final QuestionEnabledWhenEntity? enabledWhen;
  final String? systemRole;
  final String? scoringFactorCode;
  final String? profileField;
  final List<QuestionOptionEntity> options;

  @override
  List<Object?> get props => [code, type, displayOrder, isRequired];
}
