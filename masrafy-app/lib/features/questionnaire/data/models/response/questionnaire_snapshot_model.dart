import 'package:app/features/questionnaire/domain/entities/questionnaire_snapshot_entity.dart';
import 'package:app/features/questionnaire/domain/enums/enabled_when_operator.dart';
import 'package:app/features/questionnaire/domain/enums/question_type.dart';

/// Wire model for the questionnaire snapshot (`GET /api/v1/questionnaire` →
/// `data`). Feature 010 / constitution v10.0.0 made the pool GLOBAL, so the
/// payload no longer carries a category. Hand-written `fromJson` (no codegen,
/// per the auth-feature convention); `toEntity()` sorts groups / questions /
/// options into display order so the UI never re-sorts.
///
/// Root model + its nested models (group / question / option / rules /
/// enabledWhen) live in this one file on purpose (payload co-location); do not
/// split per-class.
class QuestionnaireSnapshotModel {
  const QuestionnaireSnapshotModel({
    required this.versionNumber,
    required this.groups,
  });

  factory QuestionnaireSnapshotModel.fromJson(Map<String, dynamic> json) {
    final rawGroups = json['groups'];
    return QuestionnaireSnapshotModel(
      versionNumber: (json['versionNumber'] as num?)?.toInt() ?? 0,
      groups: rawGroups is List
          ? rawGroups
              .whereType<Map<String, dynamic>>()
              .map(QuestionGroupModel.fromJson)
              .toList()
          : const [],
    );
  }

  final int versionNumber;
  final List<QuestionGroupModel> groups;

  QuestionnaireSnapshotEntity toEntity() => QuestionnaireSnapshotEntity(
        versionNumber: versionNumber,
        groups: groups.map((g) => g.toEntity()).toList()
          ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder)),
      );
}

class QuestionGroupModel {
  const QuestionGroupModel({
    required this.code,
    required this.titleAr,
    required this.titleEn,
    required this.displayOrder,
    required this.questions,
  });

  factory QuestionGroupModel.fromJson(Map<String, dynamic> json) {
    final rawQuestions = json['questions'];
    return QuestionGroupModel(
      code: json['code'] as String? ?? '',
      titleAr: json['titleAr'] as String? ?? '',
      titleEn: json['titleEn'] as String? ?? '',
      displayOrder: (json['displayOrder'] as num?)?.toInt() ?? 0,
      questions: rawQuestions is List
          ? rawQuestions
              .whereType<Map<String, dynamic>>()
              .map(QuestionModel.fromJson)
              .toList()
          : const [],
    );
  }

  final String code;
  final String titleAr;
  final String titleEn;
  final int displayOrder;
  final List<QuestionModel> questions;

  QuestionGroupEntity toEntity() => QuestionGroupEntity(
        code: code,
        titleAr: titleAr,
        titleEn: titleEn,
        displayOrder: displayOrder,
        questions: questions.map((q) => q.toEntity()).toList()
          ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder)),
      );
}

class QuestionModel {
  const QuestionModel({
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

  factory QuestionModel.fromJson(Map<String, dynamic> json) {
    final rawOptions = json['options'];
    final rawEnabledWhen = json['enabledWhen'];
    final rawNumeric = json['numeric'];
    final rawText = json['text'];
    return QuestionModel(
      code: json['code'] as String? ?? '',
      type: json['type'] as String? ?? 'SINGLE_SELECT',
      questionAr: json['questionAr'] as String? ?? '',
      questionEn: json['questionEn'] as String? ?? '',
      helperTextAr: json['helperTextAr'] as String?,
      helperTextEn: json['helperTextEn'] as String?,
      isRequired: json['isRequired'] as bool? ?? false,
      displayOrder: (json['displayOrder'] as num?)?.toInt() ?? 0,
      enabledWhen: rawEnabledWhen is Map<String, dynamic>
          ? QuestionEnabledWhenModel.fromJson(rawEnabledWhen)
          : null,
      // The rule blocks are omitted entirely for the types that don't own them,
      // so absence is normal — never a parse failure.
      numeric: rawNumeric is Map<String, dynamic>
          ? NumericRulesModel.fromJson(rawNumeric)
          : null,
      text: rawText is Map<String, dynamic>
          ? TextRulesModel.fromJson(rawText)
          : null,
      options: rawOptions is List
          ? rawOptions
              .whereType<Map<String, dynamic>>()
              .map(QuestionOptionModel.fromJson)
              .toList()
          : const [],
    );
  }

  final String code;

  /// Raw API type string (e.g. `SINGLE_SELECT`); mapped to [QuestionType] in
  /// [toEntity].
  final String type;
  final String questionAr;
  final String questionEn;
  final String? helperTextAr;
  final String? helperTextEn;
  final bool isRequired;
  final int displayOrder;
  final QuestionEnabledWhenModel? enabledWhen;
  final NumericRulesModel? numeric;
  final TextRulesModel? text;
  final List<QuestionOptionModel> options;

  QuestionEntity toEntity() => QuestionEntity(
        code: code,
        type: QuestionType.fromApi(type),
        questionAr: questionAr,
        questionEn: questionEn,
        helperTextAr: helperTextAr,
        helperTextEn: helperTextEn,
        isRequired: isRequired,
        displayOrder: displayOrder,
        enabledWhen: enabledWhen?.toEntity(),
        numeric: numeric?.toEntity(),
        text: text?.toEntity(),
        options: options.map((o) => o.toEntity()).toList()
          ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder)),
      );
}

/// NUMERIC bounds + display unit. Every bound is nullable ("no limit") and
/// arrives as a decimal STRING — kept as a string end to end (Principle I / A3).
class NumericRulesModel {
  const NumericRulesModel({
    this.minValue,
    this.maxValue,
    this.step,
    this.unitAr,
    this.unitEn,
  });

  factory NumericRulesModel.fromJson(Map<String, dynamic> json) =>
      NumericRulesModel(
        minValue: _decimalString(json['minValue']),
        maxValue: _decimalString(json['maxValue']),
        step: _decimalString(json['step']),
        unitAr: json['unitAr'] as String?,
        unitEn: json['unitEn'] as String?,
      );

  final String? minValue;
  final String? maxValue;
  final String? step;
  final String? unitAr;
  final String? unitEn;

  NumericRulesEntity toEntity() => NumericRulesEntity(
        minValue: minValue,
        maxValue: maxValue,
        step: step,
        unitAr: unitAr,
        unitEn: unitEn,
      );
}

/// TEXT length cap.
class TextRulesModel {
  const TextRulesModel({required this.maxLength});

  factory TextRulesModel.fromJson(Map<String, dynamic> json) =>
      TextRulesModel(maxLength: (json['maxLength'] as num?)?.toInt() ?? 2000);

  final int maxLength;

  TextRulesEntity toEntity() => TextRulesEntity(maxLength: maxLength);
}

/// Bounds serialize as decimal strings, but tolerate a JSON number so a
/// hand-written or legacy snapshot never drops the bound silently.
String? _decimalString(dynamic raw) => switch (raw) {
      String value => value,
      num value => value.toString(),
      _ => null,
    };

class QuestionOptionModel {
  const QuestionOptionModel({
    required this.code,
    required this.labelAr,
    required this.labelEn,
    required this.displayOrder,
  });

  factory QuestionOptionModel.fromJson(Map<String, dynamic> json) {
    return QuestionOptionModel(
      code: json['code'] as String? ?? '',
      labelAr: json['labelAr'] as String? ?? '',
      labelEn: json['labelEn'] as String? ?? '',
      displayOrder: (json['displayOrder'] as num?)?.toInt() ?? 0,
    );
  }

  final String code;
  final String labelAr;
  final String labelEn;
  final int displayOrder;

  QuestionOptionEntity toEntity() => QuestionOptionEntity(
        code: code,
        labelAr: labelAr,
        labelEn: labelEn,
        displayOrder: displayOrder,
      );
}

class QuestionEnabledWhenModel {
  const QuestionEnabledWhenModel({
    required this.questionCode,
    required this.operator,
    required this.optionCode,
  });

  factory QuestionEnabledWhenModel.fromJson(Map<String, dynamic> json) {
    return QuestionEnabledWhenModel(
      questionCode: json['questionCode'] as String? ?? '',
      operator: json['operator'] as String? ?? 'equals',
      optionCode: json['optionCode'] as String? ?? '',
    );
  }

  final String questionCode;

  /// Raw API operator string (`equals` / `not_equals`).
  final String operator;
  final String optionCode;

  QuestionEnabledWhenEntity toEntity() => QuestionEnabledWhenEntity(
        questionCode: questionCode,
        operator: EnabledWhenOperator.fromApi(operator),
        optionCode: optionCode,
      );
}
