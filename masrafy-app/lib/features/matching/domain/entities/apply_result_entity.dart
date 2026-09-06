import 'package:equatable/equatable.dart';


/// Domain result of `POST /api/v1/apply`. Two shapes collapse into one entity:
/// a MATCHED result carries [applicationId] + ranked [offers]; a NO-MATCH result
/// has `matched == false`, empty [offers], and an optional [noMatchPrimaryReason].
///
/// Root entity + nested [OfferEntity] / [ApplySummaryEntity] live in this one
/// file on purpose (payload co-location); do not split per class.
class ApplyResultEntity extends Equatable {
  const ApplyResultEntity({
    required this.matched,
    required this.applicationId,
    required this.offers,
    this.unavailablePrograms = const [],
    this.summary,
    this.noMatchPrimaryReason,
  });

  final bool matched;
  final String applicationId;
  final List<OfferEntity> offers;

  /// Programs checked but not quotable — see [UnavailableProgramEntity].
  final List<UnavailableProgramEntity> unavailablePrograms;
  final ApplySummaryEntity? summary;
  final String? noMatchPrimaryReason;

  @override
  List<Object?> get props => [
        matched,
        applicationId,
        offers,
        unavailablePrograms,
        summary,
        noMatchPrimaryReason,
      ];
}

/// A program the engine checked but could not quote, with the reason.
///
/// Listed, never hidden. An unaffordable bank that simply vanishes reads as "this
/// bank doesn't exist for me" when the truth is "your current payments use up its
/// limit" — which is actionable.
class UnavailableProgramEntity extends Equatable {
  const UnavailableProgramEntity({
    required this.programCode,
    required this.bankName,
    required this.programFriendlyName,
    required this.reason,
    this.maxAffordableAmountEGP,
    this.dbrCapPercent,
    this.gateReasonCode,
    this.missingFactKeys = const [],
  });

  final String programCode;
  final String bankName;
  final String programFriendlyName;

  /// Backend reason code, localized at the render site (Principle III).
  final String reason;

  /// The applicant's ceiling at this program, when he is priceable and simply has
  /// no room left.
  final double? maxAffordableAmountEGP;
  final double? dbrCapPercent;

  /// Which of a collateral product's CONDITIONS refused, when one did — a closed backend
  /// code, localized at the render site (Principle III).
  final String? gateReasonCode;

  /// Which answers a collateral product is still missing, by fact key.
  final List<String> missingFactKeys;

  @override
  List<Object?> get props => [
        programCode,
        bankName,
        programFriendlyName,
        reason,
        maxAffordableAmountEGP,
        dbrCapPercent,
        gateReasonCode,
        missingFactKeys,
      ];
}

/// One ranked bank offer. Money fields are parsed doubles (the wire sends
/// decimal strings — Principle I / A3); [feesBreakdown] stays raw JSON.
class OfferEntity extends Equatable {
  const OfferEntity({
    required this.bankOfferId,
    required this.programCode,
    required this.programVersion,
    required this.bankName,
    required this.bankIsFeatured,
    required this.programFriendlyName,
    required this.effectiveRatePercent,
    required this.monthlyInstallmentEGP,
    required this.requestedLoanAmountEGP,
    required this.effectiveLoanAmountEGP,
    required this.requestedTenorMonths,
    required this.effectiveTenorMonths,
    required this.requiredDocuments,
    required this.matchReasons,
    this.feesBreakdown,
    this.maxLoanAvailableEGP,
    this.collateralCeilingEGP,
    this.dbrPercent,
    this.dbrCapPercent,
    this.isSaved = false,
  });

  final String bankOfferId;
  final String programCode;
  final int programVersion;
  final String bankName;
  final bool bankIsFeatured;
  final String programFriendlyName;
  final double effectiveRatePercent;
  final double monthlyInstallmentEGP;
  final double requestedLoanAmountEGP;
  final double effectiveLoanAmountEGP;
  final int requestedTenorMonths;
  final int effectiveTenorMonths;
  final List<String> requiredDocuments;
  final List<String> matchReasons;
  final Map<String, dynamic>? feesBreakdown;

  /// The most this applicant could borrow from this program — income × DBR cap
  /// minus existing obligations, present-valued over the term. Independent of
  /// the amount requested, so it answers "how much can I get" even when the
  /// customer asked for less.
  final double? maxLoanAvailableEGP;

  /// What the customer's COLLATERAL supports at this program — the ceiling the bank derived
  /// from the unit or the membership, before their existing payments are taken off.
  ///
  /// Distinct from [maxLoanAvailableEGP] on purpose: that one is what their obligations leave
  /// room for. Null unless the program prices off collateral, which is most of them.
  final double? collateralCeilingEGP;

  /// Where this offer's installment lands on the debt-burden scale, and the cap
  /// it was measured against.
  final double? dbrPercent;
  final double? dbrCapPercent;

  /// True when the authenticated customer has already saved this offer.
  final bool isSaved;

  /// True when the customer asked for less than they could have borrowed —
  /// the case worth surfacing, since nothing else on the card reveals it.
  bool get hasUnusedHeadroom =>
      maxLoanAvailableEGP != null &&
      maxLoanAvailableEGP! > effectiveLoanAmountEGP;

  /// Total repayable over the effective term = installment × months.
  double get totalRepayableEGP => monthlyInstallmentEGP * effectiveTenorMonths;

  /// Interest paid = total repayable − financed principal (never negative).
  double get totalInterestEGP {
    final interest = totalRepayableEGP - effectiveLoanAmountEGP;
    return interest < 0 ? 0 : interest;
  }

  @override
  List<Object?> get props => [
        bankOfferId,
        programCode,
        programVersion,
        bankName,
        bankIsFeatured,
        programFriendlyName,
        effectiveRatePercent,
        monthlyInstallmentEGP,
        requestedLoanAmountEGP,
        effectiveLoanAmountEGP,
        requestedTenorMonths,
        effectiveTenorMonths,
        requiredDocuments,
        matchReasons,
        feesBreakdown,
        maxLoanAvailableEGP,
        collateralCeilingEGP,
        dbrPercent,
        dbrCapPercent,
        isSaved,
      ];
}

/// Application-level roll-up returned alongside the offers.
class ApplySummaryEntity extends Equatable {
  const ApplySummaryEntity({
    required this.totalProgramsChecked,
    required this.eligiblePrograms,
    required this.bestInstallmentEGP,
    required this.bestRatePercent,
  });

  final int totalProgramsChecked;
  final int eligiblePrograms;
  final double bestInstallmentEGP;
  final double bestRatePercent;

  @override
  List<Object?> get props => [
        totalProgramsChecked,
        eligiblePrograms,
        bestInstallmentEGP,
        bestRatePercent
      ];
}
