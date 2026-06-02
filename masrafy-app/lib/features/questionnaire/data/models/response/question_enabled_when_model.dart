import '../../../domain/entities/question_enabled_when_entity.dart';
import '../../../domain/enums/enabled_when_operator.dart';

/// Wire-format conditional-visibility rule DTO.
class QuestionEnabledWhenModel {
  QuestionEnabledWhenModel({
    required this.questionCode,
    required this.operator,
    required this.optionCode,
  });

  factory QuestionEnabledWhenModel.fromJson(Map<String, dynamic> json) {
    return QuestionEnabledWhenModel(
      questionCode: json['questionCode'] as String? ?? '',
      operator: json['operator'] as String? ?? '',
      optionCode: json['optionCode'] as String? ?? '',
    );
  }

  final String questionCode;
  final String operator;
  final String optionCode;

  QuestionEnabledWhenEntity toEntity() => QuestionEnabledWhenEntity(
        questionCode: questionCode,
        operator: EnabledWhenOperator.fromWire(operator),
        optionCode: optionCode,
      );
}
