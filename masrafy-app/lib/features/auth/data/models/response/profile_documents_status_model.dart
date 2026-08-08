import 'package:app/features/auth/domain/entities/profile_documents_status_entity.dart';

/// `GET /api/v1/profile/documents/status` → per-document upload flags.
/// Data-layer wire model; mapped to [ProfileDocumentsStatusEntity] by the
/// repository (Principle XXX).
class ProfileDocumentsStatusModel {
  const ProfileDocumentsStatusModel({
    required this.profilePhoto,
    required this.nationalIdFront,
    required this.nationalIdBack,
    this.profilePhotoUrl,
    this.nationalIdFrontUrl,
    this.nationalIdBackUrl,
  });

  factory ProfileDocumentsStatusModel.fromJson(Map<String, dynamic> json) =>
      ProfileDocumentsStatusModel(
        profilePhoto: json['profilePhoto'] as bool? ?? false,
        nationalIdFront: json['nationalIdFront'] as bool? ?? false,
        nationalIdBack: json['nationalIdBack'] as bool? ?? false,
        profilePhotoUrl: json['profilePhotoUrl'] as String?,
        nationalIdFrontUrl: json['nationalIdFrontUrl'] as String?,
        nationalIdBackUrl: json['nationalIdBackUrl'] as String?,
      );

  final bool profilePhoto;
  final bool nationalIdFront;
  final bool nationalIdBack;

  /// Presigned GET URLs (short TTL). Absent on an older backend, which is why
  /// they are nullable rather than defaulted — a missing URL must read as "no
  /// preview available", never as "not uploaded".
  final String? profilePhotoUrl;
  final String? nationalIdFrontUrl;
  final String? nationalIdBackUrl;

  ProfileDocumentsStatusEntity toEntity() => ProfileDocumentsStatusEntity(
        profilePhoto: profilePhoto,
        nationalIdFront: nationalIdFront,
        nationalIdBack: nationalIdBack,
        profilePhotoUrl: profilePhotoUrl,
        nationalIdFrontUrl: nationalIdFrontUrl,
        nationalIdBackUrl: nationalIdBackUrl,
      );
}
