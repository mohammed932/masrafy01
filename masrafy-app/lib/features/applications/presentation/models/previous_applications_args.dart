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

/// Backing data for the "Applications" screen. Deterministic mock for this
/// iteration — there is no customer list-applications API yet — mirroring the
/// three Figma cards (Applied 98% / Approved 72% / Rejected 72%).
class PreviousApplicationsArgs {
  const PreviousApplicationsArgs({required this.items});

  /// Past applications, most recent first.
  final List<PastApplication> items;

  factory PreviousApplicationsArgs.mock() {
    MatchOffer offer(int approvalPct) => MatchOffer(
          approvalPct: approvalPct,
          termMonths: 36,
          ratePct: 10.1,
          monthly: 4720,
          totalLabel: '170K',
          totalInterest: 20320,
          totalLoan: 170320,
        );
    return PreviousApplicationsArgs(
      items: [
        PastApplication(
          status: PastApplicationStatus.applied,
          loanTypeKey: 'personal',
          amount: 150000,
          offer: offer(98),
        ),
        PastApplication(
          status: PastApplicationStatus.approved,
          loanTypeKey: 'personal',
          amount: 150000,
          offer: offer(72),
        ),
        PastApplication(
          status: PastApplicationStatus.rejected,
          loanTypeKey: 'personal',
          amount: 150000,
          offer: offer(72),
        ),
      ],
    );
  }
}
