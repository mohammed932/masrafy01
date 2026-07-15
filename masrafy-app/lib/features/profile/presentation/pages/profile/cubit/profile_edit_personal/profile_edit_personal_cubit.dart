import 'dart:typed_data';

import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/result/failure.dart';
import 'package:app/core/widgets/bottom_sheets/masrafy_photo_source_sheet.dart';
import 'package:app/features/auth/data/models/request/profile/complete_profile_request.dart';
import 'package:app/features/auth/domain/usecases/customer_auth_usecase.dart';
import 'package:app/features/profile/data/models/request/update_profile_request.dart';
import 'package:app/features/profile/domain/usecases/profile_usecase.dart';
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
  ProfileEditPersonalCubit(this._customerAuth, this._profile)
      : super(const ProfileEditPersonalState());

  final CustomerAuthUseCase _customerAuth;
  final ProfileUseCase _profile;
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

  /// Pre-checks the National-ID tiles from the server's document status so they
  /// reflect what is already on file (mirrors `ApplyDocumentsCubit.load`). A
  /// failure is swallowed — the user can still upload; tiles just stay unmarked.
  Future<void> loadDocumentsStatus() async {
    final res = await _customerAuth.profileDocumentsStatus();
    res.fold(
      (_) {},
      (status) => emit(state.copyWith(
        frontUploaded: status.nationalIdFront,
        backUploaded: status.nationalIdBack,
      )),
    );
  }

  /// Picks a National-ID image and uploads one side through the customer-scoped
  /// pipeline (presign → S3 PUT → confirm). Emits onto the per-side uploading
  /// flag + [docError]; on success flips the side's uploaded flag.
  Future<void> pickAndUploadNationalId({required bool front}) async {
    if (front ? state.frontUploading : state.backUploading) return;
    final picked = await _pickDocument();
    if (picked == null) return;
    emit(front
        ? state.copyWith(frontUploading: true, docError: null)
        : state.copyWith(backUploading: true, docError: null));
    final res = await _customerAuth.uploadNationalIdSide(
      UploadNationalIdRequest(
        documentType: front ? 'NATIONAL_ID_FRONT' : 'NATIONAL_ID_BACK',
        bytes: picked.bytes,
        contentType: picked.contentType,
        filename: picked.filename,
      ),
    );
    res.fold(
      (err) => emit(front
          ? state.copyWith(frontUploading: false, docError: err)
          : state.copyWith(backUploading: false, docError: err)),
      (_) => emit(front
          ? state.copyWith(frontUploading: false, frontUploaded: true)
          : state.copyWith(backUploading: false, backUploaded: true)),
    );
  }

  /// Persists first/last name via `PATCH /auth/profile` (partial scalar edit;
  /// birthday is locked/never sent — immutable once set, Principle XXXVII). On
  /// success flips [saved] so the page pops the draft back.
  Future<void> save() async {
    if (!state.canSave) return;
    emit(state.copyWith(saving: true, saveError: null));
    final res = await _profile.updateProfile(
      UpdateProfileRequest(
        firstName: state.firstName.trim(),
        lastName: state.lastName.trim(),
      ),
    );
    res.fold(
      (err) => emit(state.copyWith(saving: false, saveError: err)),
      (_) => emit(state.copyWith(saving: false, saved: true)),
    );
  }

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
      filename: file.name,
    );
  }

  Future<_PickedImage?> _pickDocument() async {
    final file = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 2000,
    );
    if (file == null) return null;
    final bytes = await file.readAsBytes();
    return _PickedImage(
      bytes: bytes,
      contentType: file.mimeType ?? _mimeFromName(file.name),
      filename: file.name,
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
  const _PickedImage({
    required this.bytes,
    required this.contentType,
    required this.filename,
  });

  final Uint8List bytes;
  final String contentType;
  final String filename;
}
