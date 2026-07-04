import '../enums/enabled_when_operator.dart';
import '../enums/loan_category.dart';
import '../enums/question_type.dart';

/// Domain view of the immutable questionnaire snapshot returned by
/// `GET /api/v1/questionnaire/:category` (Constitution Principle V — the
/// questionnaire is admin-editable DATA, published as versioned content-only
/// snapshots). Bilingual labels are kept as-is; the UI resolves the active
/// locale via `label(isAr)`.
///
/// Root entity + its nested entities (group / question / option / enabledWhen)
/// live in this one file on purpose (payload co-location); do not split
/// per-class.
class QuestionnaireSnapshotEntity {
  const QuestionnaireSnapshotEntity({
    required this.category,
    required this.versionNumber,
    required this.groups,
  });

  final LoanCategory category;
  final int versionNumber;

  /// Groups in display order (sorted at the data boundary).
  final List<QuestionGroupEntity> groups;
}

class QuestionGroupEntity {
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

  /// Questions in display order (sorted at the data boundary).
  final List<QuestionEntity> questions;

  String title(bool isAr) => isAr ? titleAr : titleEn;
}

class QuestionEntity {
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
  });

  final String code;
  final QuestionType type;
  final String questionAr;
  final String questionEn;
  final bool isRequired;
  final int displayOrder;
  final List<QuestionOptionEntity> options;
  final String? helperTextAr;
  final String? helperTextEn;

  /// Conditional-visibility rule, or null when the question is always shown.
  final QuestionEnabledWhenEntity? enabledWhen;

  String label(bool isAr) => isAr ? questionAr : questionEn;
  String? helper(bool isAr) => isAr ? helperTextAr : helperTextEn;
}

class QuestionOptionEntity {
  const QuestionOptionEntity({
    required this.code,
    required this.labelAr,
    required this.labelEn,
    required this.displayOrder,
  });

  final String code;
  final String labelAr;
  final String labelEn;
  final int displayOrder;

  String label(bool isAr) => isAr ? labelAr : labelEn;
}

class QuestionEnabledWhenEntity {
  const QuestionEnabledWhenEntity({
    required this.questionCode,
    required this.operator,
    required this.optionCode,
  });

  final String questionCode;
  final EnabledWhenOperator operator;
  final String optionCode;

  /// Whether the guarded question should be visible given the current picked
  /// [answers] (questionCode → optionCode). An unanswered controlling question
  /// reads as "not equal", so an `equals` gate stays hidden until the trigger
  /// value is picked.
  bool isSatisfied(Map<String, String> answers) {
    final current = answers[questionCode];
    return switch (operator) {
      EnabledWhenOperator.equals => current == optionCode,
      EnabledWhenOperator.notEquals => current != optionCode,
    };
  }
}
