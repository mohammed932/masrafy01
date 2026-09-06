import 'package:app/features/applications/domain/entities/application_summary_entity.dart';
import 'package:app/features/offers/presentation/models/match_results_args.dart';

/// Decision state shown as the status pill on a [PastApplication] card
/// (Figma `4088:296`): amber "Applied", green "Approved", red "Rejected".
enum PastApplicationStatus { applied, approved, rejected }

/// Wire status (`applied` | `approved` | `rejected`) → pill. An unknown value
/// reads as "applied": the customer proceeded, and no decision is on file.
PastApplicationStatus pastApplicationStatusFrom(String status) =>
    switch (status) {
      'approved' => PastApplicationStatus.approved,
      'rejected' => PastApplicationStatus.rejected,
      _ => PastApplicationStatus.applied,
    };

/// One row on the "Applications" screen — a past loan application the user
/// submitted. Wraps the shared [MatchOffer] (so the card reuses the same
/// approval / rate / monthly / total shape as the live offers list) plus the
/// loan summary needed to reopen the existing Offer Details screen.
///
/// Root + nested types live in this one file on purpose (payload
/// co-location); do not split per-class.
class PastApplication {
  const PastApplication({
    required this.status,
    required this.loanTypeKey,
    required this.amount,
    required this.offer,
  });

  /// Submission outcome — drives the status pill.
  final PastApplicationStatus status;

  /// Language-neutral loan category id (`personal` | `car` | `mortgage` |
  /// `business`); resolved to a localized label by [loanTypeLabel].
  final String loanTypeKey;

  /// Requested principal (EGP), carried through to Offer Details.
  final double amount;

  /// The matched offer this application produced.
  final MatchOffer offer;

  /// The application this row belongs to — the key the offer-details screen
  /// re-fetches on, so it never renders a cached copy of the offer.
  String get applicationId => offer.applicationId;

  /// Map a backend application row to its display shape. The ONE place this
  /// mapping lives: both the Applications list and the offer-details fetch go
  /// through it, so a card and the screen it opens cannot disagree.
  factory PastApplication.fromEntity(ApplicationSummaryEntity e) =>
      PastApplication(
        status: pastApplicationStatusFrom(e.status),
        loanTypeKey: e.category,
        amount: e.requestedAmountEGP,
        offer: MatchOffer.fromEntity(
          e.offer,
          applicationId: e.applicationId,
          isTopPick: false,
          // Every application here is one the customer already proceeded with
          // (applied / approved / rejected) — the Offer Details Apply CTA is
          // hidden for all of them.
          alreadyApplied: true,
        ),
      );

  /// Build the payload the existing `OfferDetailsRoute` expects.
  MatchResultsArgs toSummary() => MatchResultsArgs(
        loanTypeKey: loanTypeKey,
        amount: amount,
        durationMonths: offer.termMonths,
        offers: [offer],
      );
}
