import 'package:equatable/equatable.dart';

import 'package:app/features/matching/domain/enums/approval_tier.dart';

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
    this.summary,
    this.noMatchPrimaryReason,
  });

  final bool matched;
  final String applicationId;
  final List<OfferEntity> offers;
  final ApplySummaryEntity? summary;
  final String? noMatchPrimaryReason;

  @override
  List<Object?> get props =>
      [matched, applicationId, offers, summary, noMatchPrimaryReason];
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
    required this.currency,
    required this.effectiveRatePercent,
    required this.monthlyInstallmentEGP,
    required this.requestedLoanAmountEGP,
    required this.effectiveLoanAmountEGP,
    required this.requestedTenorMonths,
    required this.effectiveTenorMonths,
    required this.approvalScore,
    required this.approvalTier,
    required this.tierLabelCode,
    required this.requiredDocuments,
    required this.matchReasons,
    this.feesBreakdown,
    this.maxLoanAvailableEGP,
  });

  final String bankOfferId;
  final String programCode;
  final int programVersion;
  final String bankName;
  final bool bankIsFeatured;
  final String programFriendlyName;
  final String currency;
  final double effectiveRatePercent;
  final double monthlyInstallmentEGP;
  final double requestedLoanAmountEGP;
  final double effectiveLoanAmountEGP;
  final int requestedTenorMonths;
  final int effectiveTenorMonths;
  final int approvalScore;
  final ApprovalTier approvalTier;
  final String tierLabelCode;
  final List<String> requiredDocuments;
  final List<String> matchReasons;
  final Map<String, dynamic>? feesBreakdown;
  final double? maxLoanAvailableEGP;

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
        currency,
        effectiveRatePercent,
        monthlyInstallmentEGP,
        requestedLoanAmountEGP,
        effectiveLoanAmountEGP,
        requestedTenorMonths,
        effectiveTenorMonths,
        approvalScore,
        approvalTier,
        tierLabelCode,
        requiredDocuments,
        matchReasons,
        feesBreakdown,
        maxLoanAvailableEGP,
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
  List<Object?> get props =>
      [totalProgramsChecked, eligiblePrograms, bestInstallmentEGP, bestRatePercent];
}
