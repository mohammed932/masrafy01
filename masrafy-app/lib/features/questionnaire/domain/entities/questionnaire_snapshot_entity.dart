import '../enums/enabled_when_operator.dart';
import '../enums/question_type.dart';
import 'question_answer.dart';

/// Domain view of the immutable questionnaire snapshot returned by
/// `GET /api/v1/questionnaire` (Constitution Principle V — the questionnaire is
/// admin-editable DATA, published as versioned content-only snapshots).
/// Feature 010 / constitution v10.0.0 made it ONE GLOBAL pool: the snapshot no
/// longer carries a category, and the chosen loan category filters only which
/// *programs* match, never which questions are asked. Bilingual labels are kept
/// as-is; the UI resolves the active locale via `label(isAr)`.
///
/// Root entity + its nested entities (group / question / option / rules /
/// enabledWhen) live in this one file on purpose (payload co-location); do not
/// split per-class.
class QuestionnaireSnapshotEntity {
  const QuestionnaireSnapshotEntity({
    required this.versionNumber,
    required this.groups,
  });

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
    this.numeric,
    this.text,
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

  /// Bounds + display unit, present only on [QuestionType.numeric] questions.
  final NumericRulesEntity? numeric;

  /// Length cap, present only on [QuestionType.text] questions.
  final TextRulesEntity? text;

  String label(bool isAr) => isAr ? questionAr : questionEn;
  String? helper(bool isAr) => isAr ? helperTextAr : helperTextEn;
}

/// CONTENT rules for a NUMERIC question — the admin-set bounds mirrored from
/// `Question.numericMin/Max/Step/Unit*`. Values stay decimal STRINGS on the
/// wire (Principle I); [minNum] / [maxNum] / [stepNum] parse them for local
/// bound feedback only. The server remains the authority
/// (`ANSWER_OUT_OF_RANGE`).
class NumericRulesEntity {
  const NumericRulesEntity({
    this.minValue,
    this.maxValue,
    this.step,
    this.unitAr,
    this.unitEn,
  });

  final String? minValue;
  final String? maxValue;
  final String? step;
  final String? unitAr;
  final String? unitEn;

  num? get minNum => minValue == null ? null : num.tryParse(minValue!);
  num? get maxNum => maxValue == null ? null : num.tryParse(maxValue!);
  num? get stepNum => step == null ? null : num.tryParse(step!);

  /// Display forms of the bounds — the wire carries 2-dp decimals
  /// (`20000000.00`), which read as `20,000,000` in hints and range messages.
  String? get minDisplay => _display(minValue);
  String? get maxDisplay => _display(maxValue);
  String? get stepDisplay => _display(step);

  /// Drops an all-zero fraction (`120.00` → `120`, `1.50` → `1.5`) and groups
  /// the integer part in thousands (`20000000.00` → `20,000,000`).
  static String? _display(String? raw) {
    if (raw == null) return null;
    var value = raw;
    if (value.contains('.')) {
      value = value.replaceFirst(RegExp(r'\.?0+$'), '');
      if (value.isEmpty) return '0';
    }
    final dot = value.indexOf('.');
    final whole = dot == -1 ? value : value.substring(0, dot);
    final fraction = dot == -1 ? '' : value.substring(dot);
    final grouped = whole.replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+$)'),
      (m) => '${m[1]},',
    );
    return '$grouped$fraction';
  }

  String? unit(bool isAr) => isAr ? unitAr : unitEn;

  /// Whether [value] satisfies the bounds. Mirrors the server's rule exactly:
  /// inclusive min/max, and the step counted UP FROM the minimum (0 when no
  /// minimum is set).
  bool accepts(num value) {
    final min = minNum;
    final max = maxNum;
    final step = stepNum;
    if (min != null && value < min) return false;
    if (max != null && value > max) return false;
    if (step != null && step > 0) {
      final offset = value - (min ?? 0);
      // Tolerant remainder: the values are 2-dp decimals typed as doubles, so a
      // strict `% == 0` would reject e.g. 3000 against a 1000 step.
      final remainder = (offset / step - (offset / step).roundToDouble()).abs();
      if (remainder > 1e-6) return false;
    }
    return true;
  }
}

/// CONTENT rules for a TEXT question — mirrors `Question.textMaxLength`.
class TextRulesEntity {
  const TextRulesEntity({required this.maxLength});

  final int maxLength;
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

  /// Whether the guarded question should be visible given the current
  /// [answers]. Mirrors the server's `isQuestionVisible`: a multi-pick answer
  /// satisfies `equals` when ANY picked code matches, and an unanswered
  /// controlling question reads as "not picked" — so an `equals` gate stays
  /// hidden until the trigger value is chosen.
  bool isSatisfied(Map<String, QuestionAnswer> answers) {
    final picked = answers[questionCode]?.pickedOptionCodes ?? const <String>[];
    final matches = picked.contains(optionCode);
    return switch (operator) {
      EnabledWhenOperator.equals => matches,
      EnabledWhenOperator.notEquals => !matches,
    };
  }
}
