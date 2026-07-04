import 'package:app/features/questionnaire/domain/entities/questionnaire_snapshot_entity.dart';
import 'package:app/features/questionnaire/domain/enums/enabled_when_operator.dart';
import 'package:app/features/questionnaire/domain/enums/loan_category.dart';
import 'package:app/features/questionnaire/domain/enums/question_type.dart';

/// Wire model for the questionnaire snapshot (`GET /api/v1/questionnaire/:category`
/// → `data`). Hand-written `fromJson` (no codegen, per the auth-feature
/// convention); `toEntity()` sorts groups / questions / options into display
/// order so the UI never re-sorts.
///
/// Root model + its nested models (group / question / option / enabledWhen)
/// live in this one file on purpose (payload co-location); do not split
/// per-class.
class QuestionnaireSnapshotModel {
  const QuestionnaireSnapshotModel({
    required this.category,
    required this.versionNumber,
    required this.groups,
  });

  factory QuestionnaireSnapshotModel.fromJson(Map<String, dynamic> json) {
    final rawGroups = json['groups'];
    return QuestionnaireSnapshotModel(
      category: json['category'] as String? ?? 'personal',
      versionNumber: (json['versionNumber'] as num?)?.toInt() ?? 0,
      groups: rawGroups is List
          ? rawGroups
              .whereType<Map<String, dynamic>>()
              .map(QuestionGroupModel.fromJson)
              .toList()
          : const [],
    );
  }

  final String category;
  final int versionNumber;
  final List<QuestionGroupModel> groups;

  QuestionnaireSnapshotEntity toEntity() => QuestionnaireSnapshotEntity(
        category: LoanCategory.fromCode(category),
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
  });

  factory QuestionModel.fromJson(Map<String, dynamic> json) {
    final rawOptions = json['options'];
    final rawEnabledWhen = json['enabledWhen'];
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
        options: options.map((o) => o.toEntity()).toList()
          ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder)),
      );
}

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
