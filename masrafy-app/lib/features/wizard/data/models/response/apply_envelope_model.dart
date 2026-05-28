import '../../../domain/entities/apply_result_entity.dart';
import 'bank_offer_model.dart';

/// Wire-format response envelope for `POST /api/v1/apply`. Lives in
/// `data/models/response/` per Constitution Principle XXX — class name
/// ends in `Model` because this is a response DTO. The repository maps
/// this to the domain `ApplyResultEntity` before crossing the boundary.
class ApplyEnvelopeModel {
  const ApplyEnvelopeModel({
    required this.success,
    required this.code,
    required this.applicationId,
    required this.matchedOffers,
    this.primaryReason,
    this.totalProgramsChecked = 0,
    this.eligiblePrograms = 0,
  });

  factory ApplyEnvelopeModel.fromJson(Map<String, dynamic> json) {
    final isSuccess = json['success'] == true;
    if (isSuccess) {
      final data = (json['data'] as Map<String, dynamic>?) ?? const {};
      final summary = (data['summary'] as Map<String, dynamic>?) ?? const {};
      return ApplyEnvelopeModel(
        success: true,
        code: 'MATCHED',
        applicationId: data['applicationId'] as String,
        matchedOffers: (data['matchedOffers'] as List<dynamic>? ?? const [])
            .map((o) => BankOfferModel.fromJson(o as Map<String, dynamic>))
            .toList(),
        totalProgramsChecked: summary['totalProgramsChecked'] as int? ?? 0,
        eligiblePrograms: summary['eligiblePrograms'] as int? ?? 0,
      );
    }
    final meta = (json['meta'] as Map<String, dynamic>?) ?? const {};
    return ApplyEnvelopeModel(
      success: false,
      code: (json['code'] as String?) ?? 'NO_MATCHING_PROGRAMS',
      applicationId: (meta['applicationId'] as String?) ?? '',
      matchedOffers: const [],
      primaryReason: meta['primaryReason'] as String?,
    );
  }

  final bool success;
  final String code;
  final String applicationId;
  final List<BankOfferModel> matchedOffers;
  final String? primaryReason;
  final int totalProgramsChecked;
  final int eligiblePrograms;

  ApplyResultEntity toEntity() => ApplyResultEntity(
        applicationId: applicationId,
        outcome: success ? ApplyOutcome.matched : ApplyOutcome.noMatch,
        offers: matchedOffers.map((m) => m.toEntity()).toList(),
        primaryReason: primaryReason,
        totalProgramsChecked: totalProgramsChecked,
        eligiblePrograms: eligiblePrograms,
      );
}
