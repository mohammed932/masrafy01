import 'dart:typed_data';

import 'package:bloc/bloc.dart';
import 'package:flutter/widgets.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/features/customer_photo/customer_photo_store.dart';
import 'package:app/core/features/id_capture/id_thumbnail.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/core/utils/image_pick.dart';
import 'package:app/core/utils/validators.dart';
import 'package:app/features/auth/data/models/request/profile/complete_profile_request.dart';
import 'package:app/features/auth/domain/entities/customer_entity.dart';
import 'package:app/features/auth/domain/entities/signup_draft.dart';
import 'package:app/features/auth/domain/enums/registration_path.dart';
import 'package:app/features/auth/domain/usecases/auth_usecase.dart';
import 'package:app/features/auth/domain/usecases/customer_auth_usecase.dart';

part 'complete_profile_cubit.freezed.dart';
part 'complete_profile_state.dart';

/// Mandatory profile-completion screen (Principle XXXVII). Prefills from `me()`,
/// uploads the profile photo + National ID front/back through the customer-
/// scoped presign endpoints (each: presign → S3 PUT → confirm), then submits
/// the scalar fields to flip `profileComplete`. Orchestration only — all
/// derivations live on [CompleteProfileState] (Principle XXXI).
@injectable
class CompleteProfileCubit extends Cubit<CompleteProfileState> {
  CompleteProfileCubit(this._auth, this._customerAuth, this._photos)
      : super(const CompleteProfileState());

  final AuthUseCase _auth;
  final CustomerAuthUseCase _customerAuth;
  final CustomerPhotoStore _photos;
  final MasrafyImagePicker _picker = MasrafyImagePicker();

  /// Seeds the form from the PHONE-signup [SignupDraft] so the user does not
  /// retype name / birthday / email / password already entered on signup.
  /// Call before [load] (which only fills still-empty fields).
  void seed(SignupDraft? draft) {
    if (draft == null) return;
    emit(state.copyWith(
      firstName: draft.firstName,
      lastName: draft.lastName,
      birthday: draft.birthday,
      email: draft.email ?? '',
      password: draft.password,
    ));
  }

  /// Prefills the form from the current account. The form stays usable even if
  /// this fails — submission re-validates server-side.
  ///
  /// On the Google path the account already carries whatever the provider gave
  /// us — name, plus the avatar imported into our own storage. Birthday is not
  /// among them: the app no longer requests the restricted `user.birthday.read`
  /// scope (see `GoogleSignInService`), so the customer always enters it here.
  /// Every prefill is still editable: [seed]'s values win, and the customer can
  /// overwrite any of them before submitting.
  Future<void> load() async {
    emit(state.copyWith(loadStatus: RequestState.loading));
    final res = await _auth.me();
    res.fold(
      (_) => emit(state.copyWith(loadStatus: RequestState.error)),
      (c) {
        // Same broadcast as a fresh upload — a photo the account already has is
        // the avatar every other screen should be painting from this moment on.
        if (c.photoUrl != null) _photos.publishRemote(c.photoUrl);
        emit(state.copyWith(
          loadStatus: RequestState.loaded,
          registrationPath: c.registrationPath,
          hasPassword: c.hasPassword,
          firstName:
              state.firstName.isEmpty ? _firstWord(c.name) : state.firstName,
          lastName:
              state.lastName.isEmpty ? _restWords(c.name) : state.lastName,
          birthday: state.birthday ?? c.birthday,
          photoUrl: c.photoUrl,
        ));
      },
    );
  }

  void updateField(CompleteProfileField field, Object value) {
    switch (field) {
      case CompleteProfileField.firstName:
        emit(state.copyWith(firstName: value as String, error: null));
      case CompleteProfileField.lastName:
        emit(state.copyWith(lastName: value as String, error: null));
      case CompleteProfileField.birthday:
        emit(state.copyWith(birthday: value as DateTime, error: null));
      case CompleteProfileField.password:
        emit(state.copyWith(password: value as String, error: null));
    }
  }

  void toggleObscure() => emit(state.copyWith(obscure: !state.obscure));

  Future<void> pickAndUploadPhoto() async {
    final picked = await _pick(ImagePickProfile.avatar);
    if (picked == null) return;
    emit(state.copyWith(photoUploading: true, error: null));
    final res = await _customerAuth.uploadProfilePhoto(
      UploadAssetRequest(bytes: picked.bytes, contentType: picked.contentType),
    );
    res.fold(
      (err) => emit(state.copyWith(photoUploading: false, error: err)),
      (_) {
        // Same broadcast as the profile editor — the avatar chosen here is the
        // account's photo from this moment on, on every screen that shows it.
        _photos.publishUpload(picked.bytes);
        emit(state.copyWith(
          photoUploading: false,
          photoUploaded: true,
          photoBytes: picked.bytes,
        ));
      },
    );
  }

  /// Uploads one already-captured side. The image comes from the framed camera
  /// page, which the screen pushes — a cubit must not navigate (Principle
  /// XXXI: orchestration only).
  Future<void> uploadNationalId({
    required bool front,
    required PickedImage image,
  }) async {
    emit(front
        ? state.copyWith(idFrontUploading: true, error: null)
        : state.copyWith(idBackUploading: true, error: null));
    final res = await _customerAuth.uploadNationalIdSide(
      UploadNationalIdRequest(
        documentType: front ? 'NATIONAL_ID_FRONT' : 'NATIONAL_ID_BACK',
        bytes: image.bytes,
        contentType: image.contentType,
        filename: image.filename,
      ),
    );
    res.fold(
      (err) => emit(front
          ? state.copyWith(idFrontUploading: false, error: err)
          : state.copyWith(idBackUploading: false, error: err)),
      // Bytes kept so the tile shows the shot with no extra round-trip.
      (_) => emit(front
          ? state.copyWith(
              idFrontUploading: false,
              idFrontUploaded: true,
              idFrontBytes: image.bytes,
            )
          : state.copyWith(
              idBackUploading: false,
              idBackUploaded: true,
              idBackBytes: image.bytes,
            )),
    );
  }

  Future<void> submit() async {
    if (!state.canSubmit) return;
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _customerAuth.completeProfile(
      CompleteProfileRequest(
        firstName: state.firstName.trim(),
        lastName: state.lastName.trim(),
        birthday: state.birthday!,
        email: state.email.trim().isEmpty ? null : state.email.trim(),
        password: state.requiresPassword ? state.password : null,
      ),
    );
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (session) => emit(state.copyWith(
        status: RequestState.loaded,
        session: session,
        error: null,
      )),
    );
  }

  /// Gallery pick under [profile]'s size budget. An over-budget file surfaces
  /// on [state.error] like any other failure; cancelling is silent.
  Future<PickedImage?> _pick(ImagePickProfile profile) async {
    final result = await _picker.pick(ImageSource.gallery, profile);
    switch (result) {
      case ImagePickCancelled():
        return null;
      case ImagePickTooLarge():
        emit(state.copyWith(error: const LocalFailure(code: 'IMAGE_TOO_LARGE')));
        return null;
      case ImagePickSuccess(:final image):
        return image;
    }
  }

  static String _firstWord(String name) {
    final t = name.trim();
    if (t.isEmpty) return '';
    return t.split(RegExp(r'\s+')).first;
  }

  static String _restWords(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length < 2) return '';
    return parts.sublist(1).join(' ');
  }
}
