import 'dart:typed_data';

import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/result/failure.dart';
import 'package:app/core/widgets/bottom_sheets/masrafy_photo_source_sheet.dart';
import 'package:app/features/auth/data/models/request/profile/complete_profile_request.dart';
import 'package:app/features/auth/domain/usecases/customer_auth_usecase.dart';
import 'package:app/features/profile/presentation/models/profile_data.dart';

part 'profile_edit_personal_cubit.freezed.dart';
part 'profile_edit_personal_state.dart';

/// Scalar fields editable on the Edit Personal Info screen.
enum ProfileEditPersonalField { firstName, lastName }

/// Drives the Edit Personal Info form (Figma `4028:4573`). Seeded once from the
/// route's [ProfilePersonalDraft]; on save the page pops [toDraft]. The avatar
/// picks + uploads a new photo through the shared customer-photo pipeline
/// (presign → S3 PUT → confirm). Pure orchestration — `canSave` + draft mapping
/// live on the state (Principle XXXI).
@injectable
class ProfileEditPersonalCubit extends Cubit<ProfileEditPersonalState> {
  ProfileEditPersonalCubit(this._customerAuth)
      : super(const ProfileEditPersonalState());

  final CustomerAuthUseCase _customerAuth;
  final ImagePicker _picker = ImagePicker();

  /// Seed from the current profile slice (called once in the page's provider).
  void seed(ProfilePersonalDraft d) => emit(state.copyWith(
        firstName: d.firstName,
        lastName: d.lastName,
        birthday: d.birthday,
        photoUrl: d.photoUrl,
        frontUploaded: d.frontUploaded,
        backUploaded: d.backUploaded,
      ));

  /// Text-field edits. Exhaustive over [ProfileEditPersonalField] — no
  /// `default:` (the cast target is explicit per case).
  void updateField(ProfileEditPersonalField field, Object value) {
    switch (field) {
      case ProfileEditPersonalField.firstName:
        emit(state.copyWith(firstName: value as String));
      case ProfileEditPersonalField.lastName:
        emit(state.copyWith(lastName: value as String));
    }
  }

  /// Birthday pick — kept off [updateField] so the cubit takes a typed
  /// `DateTime` rather than casting an `Object`.
  void setBirthday(DateTime value) => emit(state.copyWith(birthday: value));

  /// Picks an image from [source] and uploads it as the profile photo. The
  /// picked bytes are kept for instant preview and carried back to the Profile
  /// view via the draft.
  Future<void> pickAndUploadPhoto(PhotoPickSource source) async {
    final picked = await _pick(source);
    if (picked == null) return;
    emit(state.copyWith(photoUploading: true, photoError: null));
    final res = await _customerAuth.uploadProfilePhoto(
      UploadAssetRequest(bytes: picked.bytes, contentType: picked.contentType),
    );
    res.fold(
      (err) => emit(state.copyWith(photoUploading: false, photoError: err)),
      (_) => emit(state.copyWith(
        photoUploading: false,
        photoBytes: picked.bytes,
      )),
    );
  }

  void markFront() => emit(state.copyWith(frontUploaded: true));
  void markBack() => emit(state.copyWith(backUploaded: true));

  Future<_PickedImage?> _pick(PhotoPickSource source) async {
    final file = await _picker.pickImage(
      source: source == PhotoPickSource.camera
          ? ImageSource.camera
          : ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 2000,
    );
    if (file == null) return null;
    final bytes = await file.readAsBytes();
    return _PickedImage(
      bytes: bytes,
      contentType: file.mimeType ?? _mimeFromName(file.name),
    );
  }

  static String _mimeFromName(String name) {
    final n = name.toLowerCase();
    if (n.endsWith('.png')) return 'image/png';
    if (n.endsWith('.heic')) return 'image/heic';
    return 'image/jpeg';
  }
}

/// Picked-image transport (cubit-local).
class _PickedImage {
  const _PickedImage({required this.bytes, required this.contentType});

  final Uint8List bytes;
  final String contentType;
}
