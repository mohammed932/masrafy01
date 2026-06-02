import '../../../domain/entities/question_entity.dart';
import '../../../domain/enums/question_type.dart';
import 'question_enabled_when_model.dart';
import 'question_option_model.dart';

/// Wire-format question DTO. Composes its option list + optional
/// `enabledWhen` rule from their own DTOs.
class QuestionModel {
  QuestionModel({
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

  factory QuestionModel.fromJson(Map<String, dynamic> json) {
    final enabledWhenJson = json['enabledWhen'] as Map<String, dynamic>?;
    return QuestionModel(
      code: json['code'] as String,
      type: json['type'] as String? ?? '',
      questionAr: json['questionAr'] as String? ?? '',
      questionEn: json['questionEn'] as String? ?? '',
      helperTextAr: json['helperTextAr'] as String?,
      helperTextEn: json['helperTextEn'] as String?,
      isRequired: json['isRequired'] as bool? ?? false,
      displayOrder: json['displayOrder'] as int? ?? 0,
      enabledWhen: enabledWhenJson == null
          ? null
          : QuestionEnabledWhenModel.fromJson(enabledWhenJson),
      systemRole: json['systemRole'] as String?,
      scoringFactorCode: json['scoringFactorCode'] as String?,
      profileField: json['profileField'] as String?,
      options: (json['options'] as List<dynamic>? ?? const [])
          .map((o) => QuestionOptionModel.fromJson(o as Map<String, dynamic>))
          .toList(),
    );
  }

  final String code;
  final String type;
  final String questionAr;
  final String questionEn;
  final String? helperTextAr;
  final String? helperTextEn;
  final bool isRequired;
  final int displayOrder;
  final QuestionEnabledWhenModel? enabledWhen;
  final String? systemRole;
  final String? scoringFactorCode;
  final String? profileField;
  final List<QuestionOptionModel> options;

  QuestionEntity toEntity() => QuestionEntity(
        code: code,
        type: QuestionType.fromWire(type),
        questionAr: questionAr,
        questionEn: questionEn,
        helperTextAr: helperTextAr,
        helperTextEn: helperTextEn,
        isRequired: isRequired,
        displayOrder: displayOrder,
        enabledWhen: enabledWhen?.toEntity(),
        systemRole: systemRole,
        scoringFactorCode: scoringFactorCode,
        profileField: profileField,
        options: options.map((o) => o.toEntity()).toList(),
      );
}
