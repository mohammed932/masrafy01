import '../../../domain/entities/question_group_entity.dart';
import 'question_model.dart';

/// Wire-format question-group DTO.
class QuestionGroupModel {
  QuestionGroupModel({
    required this.code,
    required this.titleAr,
    required this.titleEn,
    required this.displayOrder,
    required this.questions,
  });

  factory QuestionGroupModel.fromJson(Map<String, dynamic> json) {
    return QuestionGroupModel(
      code: json['code'] as String? ?? '',
      titleAr: json['titleAr'] as String? ?? '',
      titleEn: json['titleEn'] as String? ?? '',
      displayOrder: json['displayOrder'] as int? ?? 0,
      questions: (json['questions'] as List<dynamic>? ?? const [])
          .map((q) => QuestionModel.fromJson(q as Map<String, dynamic>))
          .toList(),
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
        questions: questions.map((q) => q.toEntity()).toList(),
      );
}
