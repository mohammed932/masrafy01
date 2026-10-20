/// Comparison used by a question's conditional-visibility rule
/// (`enabledWhen`). The guarded question is shown when the controlling
/// question's picked option [equals] / does [notEquals] one target option, or
/// is [oneOf] a set of target options (wire `in`).
///
/// [unknown] is any operator this build does not recognise — a newer server can
/// add one before the app learns it. A rule it cannot read never HIDES its
/// question: the server may require that question, and one this build hid
/// forever could never be answered, so apply would be refused. The same stance
/// as a rule whose source question is missing from the pool
/// (`QuestionnaireState.visibleQuestions`).
enum EnabledWhenOperator {
  equals,
  notEquals,
  oneOf,
  unknown;

  static EnabledWhenOperator fromApi(String raw) => switch (raw.toLowerCase()) {
        'equals' => EnabledWhenOperator.equals,
        'not_equals' => EnabledWhenOperator.notEquals,
        'in' => EnabledWhenOperator.oneOf,
        _ => EnabledWhenOperator.unknown,
      };
}
