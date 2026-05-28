import 'package:equatable/equatable.dart';

/// Immutable bank offer snapshot returned by `POST /api/v1/apply`.
/// Mirrors `BankOffer` shape from the backend `apply-response.dto.ts`.
class BankOfferEntity extends Equatable {
  const BankOfferEntity({
    required this.programCode,
    required this.programVersion,
    required this.bankName,
    required this.bankIsFeatured,
    required this.programFriendlyName,
    required this.currency,
    required this.effectiveRatePercent,
    required this.monthlyInstallmentEGP,
    required this.effectiveLoanAmountEGP,
    required this.effectiveTenorMonths,
    required this.requiredDocuments,
    required this.approvalScore,
    required this.approvalTier,
    required this.feesBreakdown,
    this.matchReasons = const [],
  });

  final String programCode;
  final int programVersion;
  final String bankName;
  final bool bankIsFeatured;
  final String programFriendlyName;
  final String currency;
  final String effectiveRatePercent;
  final String monthlyInstallmentEGP;
  final String effectiveLoanAmountEGP;
  final int effectiveTenorMonths;
  final List<String> requiredDocuments;
  final int approvalScore;
  final String approvalTier;
  final Map<String, dynamic> feesBreakdown;
  final List<String> matchReasons;

  @override
  List<Object?> get props => [
        programCode,
        programVersion,
        bankName,
        bankIsFeatured,
        effectiveRatePercent,
        monthlyInstallmentEGP,
        effectiveLoanAmountEGP,
        effectiveTenorMonths,
        approvalScore,
        approvalTier,
      ];
}
