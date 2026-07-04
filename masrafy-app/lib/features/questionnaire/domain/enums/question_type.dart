/// Question input kind from the questionnaire snapshot. Phase 1 backend emits
/// only [singleSelect]; [multiSelect] / [text] / [numeric] are reserved for a
/// later phase and parsed defensively so an added type never crashes the app.
enum QuestionType {
  singleSelect,
  multiSelect,
  text,
  numeric;

  static QuestionType fromApi(String raw) => switch (raw.toUpperCase()) {
        'MULTI_SELECT' => QuestionType.multiSelect,
        'TEXT' => QuestionType.text,
        'NUMERIC' => QuestionType.numeric,
        _ => QuestionType.singleSelect,
      };
}
