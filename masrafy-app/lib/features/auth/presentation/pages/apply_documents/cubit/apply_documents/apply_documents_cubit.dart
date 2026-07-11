import 'dart:typed_data';

import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/auth/data/models/request/profile/complete_profile_request.dart';
import 'package:app/features/auth/domain/usecases/customer_auth_usecase.dart';

part 'apply_documents_cubit.freezed.dart';
part 'apply_documents_state.dart';

/// Apply-time document gate (Constitution v9.0.1). Fetches which documents are
/// already on file (pre-checks the tiles) then lets the user upload the profile
/// photo + National ID front/back through the customer-scoped presign endpoints
/// (each: presign → S3 PUT → confirm). When all three are present the screen
/// pops `true` and the offer page auto-resumes select-offer. Orchestration only
/// — derivations live on [ApplyDocumentsState] (Principle XXXI).
@injectable
class ApplyDocumentsCubit extends Cubit<ApplyDocumentsState> {
  ApplyDocumentsCubit(this._auth) : super(const ApplyDocumentsState());

  final CustomerAuthUseCase _auth;
  final ImagePicker _picker = ImagePicker();

  /// Pre-checks tiles from the server's document status. The screen stays
  /// usable if this fails (the user can still upload); a failure surfaces the
  /// retryable error state instead of silently showing everything as missing.
  Future<void> load() async {
    emit(state.copyWith(loadStatus: RequestState.loading, error: null));
    final res = await _auth.profileDocumentsStatus();
    res.fold(
      (err) => emit(state.copyWith(loadStatus: RequestState.error, error: err)),
      (status) => emit(state.copyWith(
        loadStatus: RequestState.loaded,
        photoUploaded: status.profilePhoto,
        idFrontUploaded: status.nationalIdFront,
        idBackUploaded: status.nationalIdBack,
      )),
    );
  }

  Future<void> pickAndUploadPhoto() async {
    if (state.photoUploading) return;
    final picked = await _pick();
    if (picked == null) return;
    emit(state.copyWith(photoUploading: true, error: null));
    final res = await _auth.uploadProfilePhoto(
      UploadAssetRequest(bytes: picked.bytes, contentType: picked.contentType),
    );
    res.fold(
      (err) => emit(state.copyWith(photoUploading: false, error: err)),
      (_) => emit(state.copyWith(
        photoUploading: false,
        photoUploaded: true,
        photoBytes: picked.bytes,
      )),
    );
  }

  Future<void> pickAndUploadNationalId({required bool front}) async {
    if (front ? state.idFrontUploading : state.idBackUploading) return;
    final picked = await _pick();
    if (picked == null) return;
    emit(front
        ? state.copyWith(idFrontUploading: true, error: null)
        : state.copyWith(idBackUploading: true, error: null));
    final res = await _auth.uploadNationalIdSide(
      UploadNationalIdRequest(
        documentType: front ? 'NATIONAL_ID_FRONT' : 'NATIONAL_ID_BACK',
        bytes: picked.bytes,
        contentType: picked.contentType,
        filename: picked.filename,
      ),
    );
    res.fold(
      (err) => emit(front
          ? state.copyWith(idFrontUploading: false, error: err)
          : state.copyWith(idBackUploading: false, error: err)),
      (_) => emit(front
          ? state.copyWith(idFrontUploading: false, idFrontUploaded: true)
          : state.copyWith(idBackUploading: false, idBackUploaded: true)),
    );
  }

  Future<_PickedImage?> _pick() async {
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
