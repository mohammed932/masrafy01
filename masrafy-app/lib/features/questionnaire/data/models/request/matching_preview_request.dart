/// Request body for `POST /api/v1/matching/preview`. Root DTO +
/// its nested [PreviewAnswer] payload are co-located in this single
/// file (per the payload co-location convention). `toJson()` only —
/// this DTO is never deserialized.
class MatchingPreviewRequest {
  const MatchingPreviewRequest({
    required this.category,
    required this.answers,
  });

  final String category;
  final List<PreviewAnswer> answers;

  Map<String, dynamic> toJson() => {
        'category': category,
        'answers': answers.map((a) => a.toJson()).toList(),
      };
}

/// One answered question forwarded to the matching-preview endpoint.
class PreviewAnswer {
  const PreviewAnswer({
    required this.questionCode,
    required this.optionCode,
  });

  final String questionCode;
  final String optionCode;

  Map<String, dynamic> toJson() => {
        'questionCode': questionCode,
        'optionCode': optionCode,
      };
}
