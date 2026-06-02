import '../../../domain/entities/matching_preview_entity.dart';
import 'preview_match_model.dart';
import 'preview_suggestion_model.dart';

/// Wire-format DTO for `POST /api/v1/matching/preview` (after envelope
/// unwrap). Composes its match + suggestion lists from their own DTOs.
class MatchingPreviewModel {
  MatchingPreviewModel({
    required this.category,
    required this.matches,
    required this.suggestions,
  });

  factory MatchingPreviewModel.fromJson(Map<String, dynamic> json) {
    return MatchingPreviewModel(
      category: json['category'] as String? ?? '',
      matches: (json['matches'] as List<dynamic>? ?? const [])
          .map((m) => PreviewMatchModel.fromJson(m as Map<String, dynamic>))
          .toList(),
      suggestions: (json['suggestions'] as List<dynamic>? ?? const [])
          .map((s) => PreviewSuggestionModel.fromJson(s as Map<String, dynamic>))
          .toList(),
    );
  }

  final String category;
  final List<PreviewMatchModel> matches;
  final List<PreviewSuggestionModel> suggestions;

  MatchingPreviewEntity toEntity() => MatchingPreviewEntity(
        category: category,
        matches: matches.map((m) => m.toEntity()).toList(),
        suggestions: suggestions.map((s) => s.toEntity()).toList(),
      );
}
