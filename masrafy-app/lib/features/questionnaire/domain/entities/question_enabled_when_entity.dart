import 'package:equatable/equatable.dart';

import '../enums/enabled_when_operator.dart';

/// Conditional-visibility rule on a question: show it only when the
/// answer to [questionCode] satisfies [operator] against [optionCode].
class QuestionEnabledWhenEntity extends Equatable {
  const QuestionEnabledWhenEntity({
    required this.questionCode,
    required this.operator,
    required this.optionCode,
  });

  final String questionCode;
  final EnabledWhenOperator operator;
  final String optionCode;

  @override
  List<Object?> get props => [questionCode, operator, optionCode];
}
