import '../../../domain/entities/preview_suggestion_entity.dart';

/// Wire-format DTO for one matching-preview suggestion.
class PreviewSuggestionModel {
  PreviewSuggestionModel({
    required this.code,
    required this.programsUnlocked,
    this.magnitude,
    this.suggestedValue,
  });

  factory PreviewSuggestionModel.fromJson(Map<String, dynamic> json) {
    return PreviewSuggestionModel(
      code: json['code'] as String? ?? '',
      magnitude: (json['magnitude'] as num?)?.toDouble(),
      programsUnlocked: json['programsUnlocked'] as int? ?? 0,
      suggestedValue: json['suggestedValue'] as String?,
    );
  }

  final String code;
  final double? magnitude;
  final int programsUnlocked;
  final String? suggestedValue;

  PreviewSuggestionEntity toEntity() => PreviewSuggestionEntity(
        code: code,
        magnitude: magnitude,
        programsUnlocked: programsUnlocked,
        suggestedValue: suggestedValue,
      );
}
