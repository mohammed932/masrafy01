import '../../../domain/entities/question_option_entity.dart';

/// Wire-format option DTO. Plain class with `fromJson` + `toEntity`
/// (mirrors `BankOfferModel` — no freezed / json_serializable).
class QuestionOptionModel {
  QuestionOptionModel({
    required this.code,
    required this.labelAr,
    required this.labelEn,
    required this.displayOrder,
    this.numericMin,
    this.numericMax,
    this.numericPoint,
    this.scoreValue,
    this.profileValue,
  });

  factory QuestionOptionModel.fromJson(Map<String, dynamic> json) {
    return QuestionOptionModel(
      code: json['code'] as String,
      labelAr: json['labelAr'] as String? ?? '',
      labelEn: json['labelEn'] as String? ?? '',
      displayOrder: json['displayOrder'] as int? ?? 0,
      numericMin: (json['numericMin'] as num?)?.toDouble(),
      numericMax: (json['numericMax'] as num?)?.toDouble(),
      numericPoint: (json['numericPoint'] as num?)?.toDouble(),
      scoreValue: json['scoreValue'] as int?,
      profileValue: json['profileValue'] as String?,
    );
  }

  final String code;
  final String labelAr;
  final String labelEn;
  final int displayOrder;
  final double? numericMin;
  final double? numericMax;
  final double? numericPoint;
  final int? scoreValue;
  final String? profileValue;

  QuestionOptionEntity toEntity() => QuestionOptionEntity(
        code: code,
        labelAr: labelAr,
        labelEn: labelEn,
        displayOrder: displayOrder,
        numericMin: numericMin,
        numericMax: numericMax,
        numericPoint: numericPoint,
        scoreValue: scoreValue,
        profileValue: profileValue,
      );
}
