/// Comparison used by a question's conditional-visibility rule
/// (`enabledWhen`). The guarded question is shown when the controlling
/// question's picked option [equals] / does [notEquals] a target option.
enum EnabledWhenOperator {
  equals,
  notEquals;

  static EnabledWhenOperator fromApi(String raw) => switch (raw.toLowerCase()) {
        'not_equals' => EnabledWhenOperator.notEquals,
        _ => EnabledWhenOperator.equals,
      };
}
