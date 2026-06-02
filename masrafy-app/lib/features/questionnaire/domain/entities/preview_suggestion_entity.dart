import 'package:equatable/equatable.dart';

/// An actionable hint telling the user which answer to change to unlock
/// more programs. `code` is mapped to a localized message by the UI —
/// never displayed raw (Constitution Principle III).
class PreviewSuggestionEntity extends Equatable {
  const PreviewSuggestionEntity({
    required this.code,
    required this.programsUnlocked,
    this.magnitude,
    this.suggestedValue,
  });

  final String code;
  final double? magnitude;
  final int programsUnlocked;
  final String? suggestedValue;

  @override
  List<Object?> get props => [code, magnitude, programsUnlocked, suggestedValue];
}
