import 'package:app/features/loan_setup/domain/enums/income_type.dart';

/// What the customer can actually pick for one loan category, derived server-side
/// from live bank programs (`GET /v1/program-options`).
///
/// Nothing here is a catalog declaration: the counts come from
/// `bank_program.programType`, which is the only statement of how a bank sells a
/// name. So a basis the operator has not staffed with a single active program
/// arrives with `programCount: 0` and is rendered disabled — never hidden, or the
/// customer cannot tell "no bank sells this that way" from "the app is old".
class ProgramOptionsEntity {
  const ProgramOptionsEntity({
    required this.category,
    required this.incomeTypes,
  });

  final String category;

  /// Both bases, always, in the order the backend sends (payslip first).
  final List<IncomeTypeOptionEntity> incomeTypes;

  /// The entry for [type], or null when the server sent a basis this build does
  /// not know.
  IncomeTypeOptionEntity? optionFor(IncomeType type) {
    for (final option in incomeTypes) {
      if (option.programType == type) return option;
    }
    return null;
  }

  /// True when at least one basis has something behind it. False means the
  /// category is unsellable right now — the wizard says so instead of offering a
  /// step where every choice is dead.
  bool get hasAnyProgram => incomeTypes.any((o) => o.programCount > 0);
}

class IncomeTypeOptionEntity {
  const IncomeTypeOptionEntity({
    required this.programType,
    required this.programCount,
    required this.programNames,
  });

  final IncomeType programType;

  /// Active programs in this category on this basis. Zero is a real state.
  final int programCount;

  /// The catalog names on offer, in catalog order. Empty exactly when
  /// [programCount] is zero.
  final List<ProgramNameOptionEntity> programNames;

  bool get isAvailable => programCount > 0;
}

class ProgramNameOptionEntity {
  const ProgramNameOptionEntity({
    required this.key,
    required this.labelEn,
    required this.labelAr,
    required this.programCount,
  });

  /// The value sent back as `programNameKey`.
  final String key;
  final String labelEn;
  final String labelAr;

  /// How many banks offer this name on the chosen basis. Always ≥ 1.
  final int programCount;

  String label({required bool isArabic}) => isArabic ? labelAr : labelEn;
}
