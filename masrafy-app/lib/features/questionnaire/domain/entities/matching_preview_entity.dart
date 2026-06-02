import 'package:equatable/equatable.dart';

import 'preview_match_entity.dart';
import 'preview_suggestion_entity.dart';

/// Result of `POST /api/v1/matching/preview` — the live preview of which
/// bank programs match the in-progress questionnaire answers.
class MatchingPreviewEntity extends Equatable {
  const MatchingPreviewEntity({
    required this.category,
    required this.matches,
    required this.suggestions,
  });

  final String category;
  final List<PreviewMatchEntity> matches;
  final List<PreviewSuggestionEntity> suggestions;

  @override
  List<Object?> get props => [category, matches, suggestions];
}
