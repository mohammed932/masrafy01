/// Conditional-visibility operator on a question's `enabledWhen` rule.
/// `unknown` is the safe fallback — an unrecognised operator keeps the
/// question visible rather than hiding required input.
enum EnabledWhenOperator {
  equals,
  notEquals,
  unknown;

  static EnabledWhenOperator fromWire(String wire) => switch (wire) {
        'equals' => EnabledWhenOperator.equals,
        'not_equals' => EnabledWhenOperator.notEquals,
        _ => EnabledWhenOperator.unknown,
      };
}
