import 'package:app/features/loan_setup/domain/entities/program_options_entity.dart';
import 'package:app/features/loan_setup/domain/enums/income_type.dart';

/// `GET /v1/program-options?category=` response.
///
/// A basis whose `programType` this build does not recognise is DROPPED, not
/// defaulted: the two known values partition every active program today, so an
/// unknown one can only mean the backend grew a third that this app has no screen
/// for. Rendering it as "payslip" would file the customer under a basis they were
/// never offered.
class ProgramOptionsModel {
  const ProgramOptionsModel({
    required this.category,
    required this.incomeTypes,
  });

  factory ProgramOptionsModel.fromJson(Map<String, dynamic> json) =>
      ProgramOptionsModel(
        category: json['category'] as String? ?? '',
        incomeTypes: (json['incomeTypes'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(IncomeTypeOptionModel.fromJson)
            .whereType<IncomeTypeOptionModel>()
            .toList(growable: false),
      );

  final String category;
  final List<IncomeTypeOptionModel> incomeTypes;

  ProgramOptionsEntity toEntity() => ProgramOptionsEntity(
        category: category,
        incomeTypes: [
          for (final option in incomeTypes)
            if (option.programType != null)
              IncomeTypeOptionEntity(
                programType: option.programType!,
                programCount: option.programCount,
                programNames: [
                  for (final name in option.programNames) name.toEntity(),
                ],
              ),
        ],
      );
}

class IncomeTypeOptionModel {
  const IncomeTypeOptionModel({
    required this.programType,
    required this.programCount,
    required this.programNames,
  });

  factory IncomeTypeOptionModel.fromJson(Map<String, dynamic> json) =>
      IncomeTypeOptionModel(
        programType: IncomeType.fromCode(json['programType'] as String?),
        programCount: (json['programCount'] as num?)?.toInt() ?? 0,
        programNames: (json['programNames'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(ProgramNameOptionModel.fromJson)
            .toList(growable: false),
      );

  /// Null when the server named a basis this build has no screen for.
  final IncomeType? programType;
  final int programCount;
  final List<ProgramNameOptionModel> programNames;
}

class ProgramNameOptionModel {
  const ProgramNameOptionModel({
    required this.key,
    required this.labelEn,
    required this.labelAr,
    required this.programCount,
  });

  factory ProgramNameOptionModel.fromJson(Map<String, dynamic> json) =>
      ProgramNameOptionModel(
        key: json['key'] as String? ?? '',
        labelEn: json['labelEn'] as String? ?? '',
        labelAr: json['labelAr'] as String? ?? '',
        programCount: (json['programCount'] as num?)?.toInt() ?? 0,
      );

  final String key;
  final String labelEn;
  final String labelAr;
  final int programCount;

  ProgramNameOptionEntity toEntity() => ProgramNameOptionEntity(
        key: key,
        labelEn: labelEn,
        labelAr: labelAr,
        programCount: programCount,
      );
}
