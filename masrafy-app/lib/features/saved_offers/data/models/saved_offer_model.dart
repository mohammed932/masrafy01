import 'package:app/features/saved_offers/domain/entities/saved_offer_entity.dart';

/// Wire models for GET /api/v1/saved-offers. Hand-written `fromJson` /
/// `toEntity` (the app does not use json_serializable for these). Money fields
/// arrive as STRINGS (backend Principle I / A3) and are parsed here.
///
/// Root list model + nested item co-located in one file on purpose; do not
/// split per class.
class SavedOffersListModel {
  const SavedOffersListModel({required this.offers});

  final List<SavedOfferModel> offers;

  factory SavedOffersListModel.fromJson(Map<String, dynamic> json) {
    final raw = json['offers'];
    final list = raw is List ? raw : const [];
    return SavedOffersListModel(
      offers: list
          .whereType<Map<String, dynamic>>()
          .map(SavedOfferModel.fromJson)
          .toList(),
    );
  }

  List<SavedOfferEntity> toEntities() =>
      offers.map((m) => m.toEntity()).toList();
}

class SavedOfferModel {
  const SavedOfferModel({
    required this.bankOfferId,
    required this.loanTypeKey,
    required this.approvalScore,
    required this.effectiveTenorMonths,
    required this.effectiveRatePercent,
    required this.monthlyInstallmentEGP,
    required this.effectiveLoanAmountEGP,
    required this.totalRepayableEGP,
    required this.totalInterestEGP,
    required this.totalLabel,
  });

  final String bankOfferId;
  final String loanTypeKey;
  final int approvalScore;
  final int effectiveTenorMonths;
  final double effectiveRatePercent;
  final double monthlyInstallmentEGP;
  final double effectiveLoanAmountEGP;
  final double totalRepayableEGP;
  final double totalInterestEGP;
  final String totalLabel;

  factory SavedOfferModel.fromJson(Map<String, dynamic> json) {
    return SavedOfferModel(
      bankOfferId: json['bankOfferId'] as String,
      loanTypeKey: (json['loanTypeKey'] as String?) ?? 'personal',
      approvalScore: _toInt(json['approvalScore']),
      effectiveTenorMonths: _toInt(json['effectiveTenorMonths']),
      effectiveRatePercent: _toDouble(json['effectiveRatePercent']),
      monthlyInstallmentEGP: _toDouble(json['monthlyInstallmentEGP']),
      effectiveLoanAmountEGP: _toDouble(json['effectiveLoanAmountEGP']),
      totalRepayableEGP: _toDouble(json['totalRepayableEGP']),
      totalInterestEGP: _toDouble(json['totalInterestEGP']),
      totalLabel: (json['totalLabel'] as String?) ?? '',
    );
  }

  SavedOfferEntity toEntity() => SavedOfferEntity(
        bankOfferId: bankOfferId,
        loanTypeKey: loanTypeKey,
        approvalPct: approvalScore,
        termMonths: effectiveTenorMonths,
        ratePct: effectiveRatePercent,
        monthly: monthlyInstallmentEGP.round(),
        amount: effectiveLoanAmountEGP,
        totalInterest: totalInterestEGP.round(),
        totalLoan: totalRepayableEGP.round(),
        totalLabel: totalLabel,
      );

  /// Accepts JSON numbers or numeric strings (money fields are strings).
  static double _toDouble(Object? v) {
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  static int _toInt(Object? v) {
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v) ?? 0;
    return 0;
  }
}
