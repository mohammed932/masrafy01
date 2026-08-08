import 'package:equatable/equatable.dart';

/// Which apply-time documents are already on file (Constitution v9.0.1).
/// Backs the apply-documents screen's pre-check so already-uploaded items
/// render as done. Photo + National ID front/back are gated only at the
/// select-offer commitment point — never for profile completeness.
class ProfileDocumentsStatusEntity extends Equatable {
  const ProfileDocumentsStatusEntity({
    required this.profilePhoto,
    required this.nationalIdFront,
    required this.nationalIdBack,
    this.profilePhotoUrl,
    this.nationalIdFrontUrl,
    this.nationalIdBackUrl,
  });

  final bool profilePhoto;
  final bool nationalIdFront;
  final bool nationalIdBack;

  /// Short-lived presigned GET URLs for the caller's own documents, so a tile
  /// can show the picture instead of only a tick. Null whenever the matching
  /// flag is false.
  final String? profilePhotoUrl;
  final String? nationalIdFrontUrl;
  final String? nationalIdBackUrl;

  /// All three required documents are present — the apply can proceed.
  bool get allPresent => profilePhoto && nationalIdFront && nationalIdBack;

  @override
  List<Object?> get props => [
        profilePhoto,
        nationalIdFront,
        nationalIdBack,
        profilePhotoUrl,
        nationalIdFrontUrl,
        nationalIdBackUrl,
      ];
}
