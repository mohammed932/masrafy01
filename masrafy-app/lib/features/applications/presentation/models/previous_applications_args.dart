import 'package:app/features/offers/presentation/models/match_results_args.dart';

/// Decision state shown as the status pill on a [PastApplication] card
/// (Figma `4088:296`): amber "Applied", green "Approved", red "Rejected".
enum PastApplicationStatus { applied, approved, rejected }

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

  /// Build the payload the existing `OfferDetailsRoute` expects.
  MatchResultsArgs toSummary() => MatchResultsArgs(
        loanTypeKey: loanTypeKey,
        amount: amount,
        durationMonths: offer.termMonths,
        offers: [offer],
      );
}
