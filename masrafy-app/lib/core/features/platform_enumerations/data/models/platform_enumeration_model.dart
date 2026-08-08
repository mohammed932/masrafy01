import 'package:app/core/features/platform_enumerations/domain/entities/platform_enumeration_entity.dart';

/// One member of an admin-managed lookup list (`GET /v1/platform-enumerations/:type`).
///
/// The registry is the single source for reference lists the operator edits —
/// governorates, required documents, transfer types. The app used to hardcode
/// copies of these, which silently drifted from what the admin dashboard showed.
class PlatformEnumerationModel {
  const PlatformEnumerationModel({
    required this.key,
    required this.labelEn,
    required this.labelAr,
    this.categories = const [],
  });

  factory PlatformEnumerationModel.fromJson(Map<String, dynamic> json) =>
      PlatformEnumerationModel(
        key: json['key'] as String? ?? '',
        labelEn: json['labelEn'] as String? ?? '',
        labelAr: json['labelAr'] as String? ?? '',
        // Absent on every non-categorised type, and absent is the same as empty
        // here only because the caller that reads it (`program_name`) is always
        // served the key by a backend that does carry the assignment.
        categories: (json['categories'] as List<dynamic>? ?? const [])
            .whereType<String>()
            .toList(growable: false),
      );

  final String key;
  final String labelEn;
  final String labelAr;
  final List<String> categories;

  PlatformEnumerationEntity toEntity() => PlatformEnumerationEntity(
        key: key,
        labelEn: labelEn,
        labelAr: labelAr,
        categories: categories,
      );
}
