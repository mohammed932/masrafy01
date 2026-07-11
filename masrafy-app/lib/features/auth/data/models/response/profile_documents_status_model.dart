import 'package:app/features/auth/domain/entities/profile_documents_status_entity.dart';

/// `GET /api/v1/profile/documents/status` → per-document upload flags.
/// Data-layer wire model; mapped to [ProfileDocumentsStatusEntity] by the
/// repository (Principle XXX).
class ProfileDocumentsStatusModel {
  const ProfileDocumentsStatusModel({
    required this.profilePhoto,
    required this.nationalIdFront,
    required this.nationalIdBack,
  });

  factory ProfileDocumentsStatusModel.fromJson(Map<String, dynamic> json) =>
      ProfileDocumentsStatusModel(
        profilePhoto: json['profilePhoto'] as bool? ?? false,
        nationalIdFront: json['nationalIdFront'] as bool? ?? false,
        nationalIdBack: json['nationalIdBack'] as bool? ?? false,
      );

  final bool profilePhoto;
  final bool nationalIdFront;
  final bool nationalIdBack;

  ProfileDocumentsStatusEntity toEntity() => ProfileDocumentsStatusEntity(
        profilePhoto: profilePhoto,
        nationalIdFront: nationalIdFront,
        nationalIdBack: nationalIdBack,
      );
}
