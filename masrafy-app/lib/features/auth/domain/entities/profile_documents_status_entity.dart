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
  });

  final bool profilePhoto;
  final bool nationalIdFront;
  final bool nationalIdBack;

  /// All three required documents are present — the apply can proceed.
  bool get allPresent => profilePhoto && nationalIdFront && nationalIdBack;

  @override
  List<Object?> get props => [profilePhoto, nationalIdFront, nationalIdBack];
}
