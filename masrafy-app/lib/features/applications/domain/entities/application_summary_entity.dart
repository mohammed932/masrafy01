import 'package:equatable/equatable.dart';

import 'package:app/features/matching/domain/entities/apply_result_entity.dart';

/// One row on the "Applications" screen — an application the customer has
/// proceeded with (Feature 008 user-intent gate). [offer] is the same
/// [OfferEntity] used by the live apply flow, so `MatchOffer.fromEntity`
/// rebuilds the existing details-screen card without a parallel model.
class ApplicationSummaryEntity extends Equatable {
  const ApplicationSummaryEntity({
    required this.applicationId,
    required this.category,
    required this.requestedAmountEGP,
    required this.status,
    required this.proceededAt,
    required this.offer,
  });

  final String applicationId;

  /// Language-neutral loan category id (`personal` | `car` | `mortgage` |
  /// `business`); resolved to a localized label by `loanTypeLabel`.
  final String category;

  /// Requested principal (EGP) — carried into the details summary.
  final double requestedAmountEGP;

  /// Bank decision on the selected offer: `applied` | `approved` | `rejected`.
  final String status;

  final DateTime proceededAt;

  final OfferEntity offer;

  @override
  List<Object?> get props =>
      [applicationId, category, requestedAmountEGP, status, proceededAt, offer];
}
