import '../../../domain/entities/bank_offer_entity.dart';

class BankOfferModel {
  BankOfferModel({
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
    required this.matchReasons,
  });

  factory BankOfferModel.fromJson(Map<String, dynamic> json) {
    final approval = json['approvalProbability'] as Map<String, dynamic>?;
    return BankOfferModel(
      programCode: json['programCode'] as String,
      programVersion: json['programVersion'] as int,
      bankName: json['bankName'] as String,
      bankIsFeatured: json['bankIsFeatured'] as bool? ?? false,
      programFriendlyName: json['programFriendlyName'] as String,
      currency: json['currency'] as String? ?? 'EGP',
      effectiveRatePercent: json['effectiveRatePercent'] as String,
      monthlyInstallmentEGP: json['monthlyInstallmentEGP'] as String,
      effectiveLoanAmountEGP: json['effectiveLoanAmountEGP'] as String,
      effectiveTenorMonths: json['effectiveTenorMonths'] as int,
      requiredDocuments:
          (json['requiredDocuments'] as List<dynamic>? ?? const []).cast<String>(),
      approvalScore: approval?['score'] as int? ?? 0,
      approvalTier: approval?['tier'] as String? ?? 'unknown',
      feesBreakdown: (json['feesBreakdown'] as Map<String, dynamic>?) ?? const {},
      matchReasons:
          (json['matchReasons'] as List<dynamic>? ?? const []).cast<String>(),
    );
  }

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

  BankOfferEntity toEntity() => BankOfferEntity(
        programCode: programCode,
        programVersion: programVersion,
        bankName: bankName,
        bankIsFeatured: bankIsFeatured,
        programFriendlyName: programFriendlyName,
        currency: currency,
        effectiveRatePercent: effectiveRatePercent,
        monthlyInstallmentEGP: monthlyInstallmentEGP,
        effectiveLoanAmountEGP: effectiveLoanAmountEGP,
        effectiveTenorMonths: effectiveTenorMonths,
        requiredDocuments: requiredDocuments,
        approvalScore: approvalScore,
        approvalTier: approvalTier,
        feesBreakdown: feesBreakdown,
        matchReasons: matchReasons,
      );
}
