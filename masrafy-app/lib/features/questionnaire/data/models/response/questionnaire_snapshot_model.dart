import '../../../domain/entities/questionnaire_snapshot_entity.dart';
import 'question_group_model.dart';

/// Wire-format DTO for the published questionnaire snapshot returned by
/// `GET /api/v1/questionnaire/{category}` (after envelope unwrap).
class QuestionnaireSnapshotModel {
  QuestionnaireSnapshotModel({
    required this.category,
    required this.versionNumber,
    required this.groups,
  });

  factory QuestionnaireSnapshotModel.fromJson(Map<String, dynamic> json) {
    return QuestionnaireSnapshotModel(
      category: json['category'] as String? ?? '',
      versionNumber: json['versionNumber'] as int? ?? 0,
      groups: (json['groups'] as List<dynamic>? ?? const [])
          .map((g) => QuestionGroupModel.fromJson(g as Map<String, dynamic>))
          .toList(),
    );
  }

  final String category;
  final int versionNumber;
  final List<QuestionGroupModel> groups;

  QuestionnaireSnapshotEntity toEntity() => QuestionnaireSnapshotEntity(
        category: category,
        versionNumber: versionNumber,
        groups: groups.map((g) => g.toEntity()).toList(),
      );
}
