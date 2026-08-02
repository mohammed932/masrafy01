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
  });

  factory PlatformEnumerationModel.fromJson(Map<String, dynamic> json) =>
      PlatformEnumerationModel(
        key: json['key'] as String? ?? '',
        labelEn: json['labelEn'] as String? ?? '',
        labelAr: json['labelAr'] as String? ?? '',
      );

  final String key;
  final String labelEn;
  final String labelAr;

  PlatformEnumerationEntity toEntity() => PlatformEnumerationEntity(
        key: key,
        labelEn: labelEn,
        labelAr: labelAr,
      );
}
