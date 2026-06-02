/// Renderable question types. `unknown` is the forward-compatible
/// fallback so a new backend type never crashes the dynamic renderer
/// (it renders nothing rather than throwing).
enum QuestionType {
  singleSelect,
  unknown;

  static QuestionType fromWire(String wire) =>
      wire == 'SINGLE_SELECT' ? QuestionType.singleSelect : QuestionType.unknown;
}
