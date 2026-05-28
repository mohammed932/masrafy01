import 'package:equatable/equatable.dart';

import 'bank_offer_entity.dart';

enum ApplyOutcome { matched, noMatch }

class ApplyResultEntity extends Equatable {
  const ApplyResultEntity({
    required this.applicationId,
    required this.outcome,
    required this.offers,
    this.primaryReason,
    this.totalProgramsChecked = 0,
    this.eligiblePrograms = 0,
  });

  final String applicationId;
  final ApplyOutcome outcome;
  final List<BankOfferEntity> offers;
  final String? primaryReason;
  final int totalProgramsChecked;
  final int eligiblePrograms;

  bool get isMatched => outcome == ApplyOutcome.matched;

  @override
  List<Object?> get props =>
      [applicationId, outcome, offers, primaryReason, totalProgramsChecked, eligiblePrograms];
}
