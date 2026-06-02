import 'package:equatable/equatable.dart';

/// One selectable answer option of a questionnaire question. Numeric +
/// scoring fields are nullable because they only apply to scoring-driven
/// options; pure profile-collection options leave them null.
class QuestionOptionEntity extends Equatable {
  const QuestionOptionEntity({
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

  final String code;
  final String labelAr;
  final String labelEn;
  final int displayOrder;
  final double? numericMin;
  final double? numericMax;
  final double? numericPoint;
  final int? scoreValue;
  final String? profileValue;

  @override
  List<Object?> get props => [code, displayOrder];
}
