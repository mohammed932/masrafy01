import 'package:app/features/matching/domain/entities/apply_result_entity.dart';
import 'package:app/features/matching/domain/enums/approval_tier.dart';

/// Wire model for `POST /api/v1/apply`. Hand-written `fromJson` / `toEntity`
/// (the app does not use json_serializable for these). Handles BOTH envelopes:
///   - `{ success:true, data:{ applicationId, summary, matchedOffers[] } }`
///   - `{ success:false, code:'NO_MATCHING_PROGRAMS', meta:{ applicationId, ... } }`
/// The no-match envelope arrives as HTTP 200 (so Dio does not throw); it is a
/// valid result with `matched:false`, NOT a failure.
///
/// Money fields arrive as STRINGS (Principle I / A3) and are parsed here. Root
/// model + nested [OfferModel] / [SummaryModel] co-located in one file; do not
/// split per class.
class ApplyResultModel {
  const ApplyResultModel({
    required this.matched,
    required this.applicationId,
    required this.offers,
    this.summary,
    this.noMatchPrimaryReason,
  });

  final bool matched;
  final String applicationId;
  final List<OfferModel> offers;
  final SummaryModel? summary;
  final String? noMatchPrimaryReason;

  factory ApplyResultModel.fromJson(Map<String, dynamic> json) {
    final success = json['success'] == true;
    if (success) {
      final data = (json['data'] as Map<String, dynamic>?) ?? const {};
      final rawOffers = data['matchedOffers'];
      final offers = (rawOffers is List ? rawOffers : const [])
          .whereType<Map<String, dynamic>>()
          .map(OfferModel.fromJson)
          .toList();
      final rawSummary = data['summary'];
      return ApplyResultModel(
        matched: true,
        applicationId: (data['applicationId'] as String?) ?? '',
        offers: offers,
        summary: rawSummary is Map<String, dynamic>
            ? SummaryModel.fromJson(rawSummary)
            : null,
      );
    }
    final meta = (json['meta'] as Map<String, dynamic>?) ?? const {};
    return ApplyResultModel(
      matched: false,
      applicationId: (meta['applicationId'] as String?) ?? '',
      offers: const [],
      noMatchPrimaryReason: meta['primaryReason'] as String?,
    );
  }

  ApplyResultEntity toEntity() => ApplyResultEntity(
        matched: matched,
        applicationId: applicationId,
        offers: offers.map((o) => o.toEntity()).toList(),
        summary: summary?.toEntity(),
        noMatchPrimaryReason: noMatchPrimaryReason,
      );
}

class OfferModel {
  const OfferModel({
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
    required this.approvalTierCode,
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
  final String approvalTierCode;
  final String tierLabelCode;
  final List<String> requiredDocuments;
  final List<String> matchReasons;
  final Map<String, dynamic>? feesBreakdown;
  final double? maxLoanAvailableEGP;

  factory OfferModel.fromJson(Map<String, dynamic> json) {
    final approval =
        (json['approvalProbability'] as Map<String, dynamic>?) ?? const {};
    return OfferModel(
      bankOfferId: (json['bankOfferId'] as String?) ?? '',
      programCode: (json['programCode'] as String?) ?? '',
      programVersion: _toInt(json['programVersion']),
      bankName: (json['bankName'] as String?) ?? '',
      bankIsFeatured: json['bankIsFeatured'] == true,
      programFriendlyName: (json['programFriendlyName'] as String?) ?? '',
      currency: (json['currency'] as String?) ?? 'EGP',
      effectiveRatePercent: _toDouble(json['effectiveRatePercent']),
      monthlyInstallmentEGP: _toDouble(json['monthlyInstallmentEGP']),
      requestedLoanAmountEGP: _toDouble(json['requestedLoanAmountEGP']),
      effectiveLoanAmountEGP: _toDouble(json['effectiveLoanAmountEGP']),
      requestedTenorMonths: _toInt(json['requestedTenorMonths']),
      effectiveTenorMonths: _toInt(json['effectiveTenorMonths']),
      approvalScore: _toInt(approval['score']),
      approvalTierCode: (approval['tier'] as String?) ?? 'very_low',
      tierLabelCode: (approval['tierLabelCode'] as String?) ?? '',
      requiredDocuments: _toStringList(json['requiredDocuments']),
      matchReasons: _toStringList(json['matchReasons']),
      feesBreakdown: json['feesBreakdown'] is Map<String, dynamic>
          ? json['feesBreakdown'] as Map<String, dynamic>
          : null,
      maxLoanAvailableEGP: json['maxLoanAvailableEGP'] == null
          ? null
          : _toDouble(json['maxLoanAvailableEGP']),
    );
  }

  OfferEntity toEntity() => OfferEntity(
        bankOfferId: bankOfferId,
        programCode: programCode,
        programVersion: programVersion,
        bankName: bankName,
        bankIsFeatured: bankIsFeatured,
        programFriendlyName: programFriendlyName,
        currency: currency,
        effectiveRatePercent: effectiveRatePercent,
        monthlyInstallmentEGP: monthlyInstallmentEGP,
        requestedLoanAmountEGP: requestedLoanAmountEGP,
        effectiveLoanAmountEGP: effectiveLoanAmountEGP,
        requestedTenorMonths: requestedTenorMonths,
        effectiveTenorMonths: effectiveTenorMonths,
        approvalScore: approvalScore,
        approvalTier: ApprovalTier.fromCode(approvalTierCode),
        tierLabelCode: tierLabelCode,
        requiredDocuments: requiredDocuments,
        matchReasons: matchReasons,
        feesBreakdown: feesBreakdown,
        maxLoanAvailableEGP: maxLoanAvailableEGP,
      );
}

class SummaryModel {
  const SummaryModel({
    required this.totalProgramsChecked,
    required this.eligiblePrograms,
    required this.bestInstallmentEGP,
    required this.bestRatePercent,
  });

  final int totalProgramsChecked;
  final int eligiblePrograms;
  final double bestInstallmentEGP;
  final double bestRatePercent;

  factory SummaryModel.fromJson(Map<String, dynamic> json) => SummaryModel(
        totalProgramsChecked: _toInt(json['totalProgramsChecked']),
        eligiblePrograms: _toInt(json['eligiblePrograms']),
        bestInstallmentEGP: _toDouble(json['bestInstallmentEGP']),
        bestRatePercent: _toDouble(json['bestRatePercent']),
      );

  ApplySummaryEntity toEntity() => ApplySummaryEntity(
        totalProgramsChecked: totalProgramsChecked,
        eligiblePrograms: eligiblePrograms,
        bestInstallmentEGP: bestInstallmentEGP,
        bestRatePercent: bestRatePercent,
      );
}

/// Accepts JSON numbers or numeric strings (money fields are strings).
double _toDouble(Object? v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? 0;
  return 0;
}

int _toInt(Object? v) {
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v) ?? 0;
  return 0;
}

List<String> _toStringList(Object? v) =>
    v is List ? v.whereType<String>().toList() : const [];
