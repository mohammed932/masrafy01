import 'package:app/features/applications/domain/entities/application_summary_entity.dart';
import 'package:app/features/matching/data/models/response/apply_result_model.dart';

/// Wire models for `GET /api/v1/applications`. Hand-written `fromJson` /
/// `toEntity` (the app does not use json_serializable for these). Each item's
/// `offer` field is byte-for-byte the same shape as `matchedOffers[i]` on
/// `POST /api/v1/apply`, so it's parsed with the existing [OfferModel] rather
/// than a second copy of the same ~15-field mapping.
///
/// Root list model + nested item co-located in one file on purpose; do not
/// split per class.
class ApplicationsListModel {
  const ApplicationsListModel({required this.applications});

  final List<ApplicationSummaryModel> applications;

  factory ApplicationsListModel.fromJson(Map<String, dynamic> json) {
    final raw = json['applications'];
    final list = raw is List ? raw : const [];
    return ApplicationsListModel(
      applications: list
          .whereType<Map<String, dynamic>>()
          .map(ApplicationSummaryModel.fromJson)
          .toList(),
    );
  }

  List<ApplicationSummaryEntity> toEntities() =>
      applications.map((m) => m.toEntity()).toList();
}

class ApplicationSummaryModel {
  const ApplicationSummaryModel({
    required this.applicationId,
    required this.category,
    required this.requestedAmountEGP,
    required this.status,
    required this.proceededAt,
    required this.offer,
  });

  final String applicationId;
  final String category;
  final double requestedAmountEGP;
  final String status;
  final DateTime proceededAt;
  final OfferModel offer;

  factory ApplicationSummaryModel.fromJson(Map<String, dynamic> json) {
    return ApplicationSummaryModel(
      applicationId: (json['applicationId'] as String?) ?? '',
      category: (json['category'] as String?) ?? 'personal',
      requestedAmountEGP: _toDouble(json['requestedAmountEGP']),
      status: (json['status'] as String?) ?? 'applied',
      proceededAt:
          DateTime.tryParse((json['proceededAt'] as String?) ?? '') ??
              DateTime.now(),
      offer: OfferModel.fromJson(
        (json['offer'] as Map<String, dynamic>?) ?? const {},
      ),
    );
  }

  ApplicationSummaryEntity toEntity() => ApplicationSummaryEntity(
        applicationId: applicationId,
        category: category,
        requestedAmountEGP: requestedAmountEGP,
        status: status,
        proceededAt: proceededAt,
        offer: offer.toEntity(),
      );

  /// Accepts JSON numbers or numeric strings (money fields are strings).
  static double _toDouble(Object? v) {
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }
}
