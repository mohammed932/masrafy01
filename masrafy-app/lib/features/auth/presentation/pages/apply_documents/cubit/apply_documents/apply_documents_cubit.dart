import 'dart:typed_data';

import 'package:bloc/bloc.dart';
import 'package:flutter/widgets.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/features/id_capture/id_thumbnail.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/core/utils/image_pick.dart';
import 'package:app/features/auth/data/models/request/profile/complete_profile_request.dart';
import 'package:app/features/auth/domain/usecases/customer_auth_usecase.dart';

part 'apply_documents_cubit.freezed.dart';
part 'apply_documents_state.dart';

/// Apply-time document gate (Constitution v9.1.0). Fetches which documents are
/// already on file (pre-checks the tiles) then lets the user upload the
/// National ID front/back through the customer-scoped presign endpoints
/// (each: presign → S3 PUT → confirm). When both ID sides are present the
/// screen pops `true` and the offer page auto-resumes select-offer. Profile
/// photo is optional (v9.1.0) and not collected here. Orchestration only
/// — derivations live on [ApplyDocumentsState] (Principle XXXI).
@injectable
class ApplyDocumentsCubit extends Cubit<ApplyDocumentsState> {
  ApplyDocumentsCubit(this._auth) : super(const ApplyDocumentsState());

  final CustomerAuthUseCase _auth;

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
        idFrontUploaded: status.nationalIdFront,
        idBackUploaded: status.nationalIdBack,
        idFrontUrl: status.nationalIdFrontUrl,
        idBackUrl: status.nationalIdBackUrl,
      )),
    );
  }

  /// Uploads one already-captured side. The image comes from the framed camera
  /// page, which the screen pushes — a cubit must not navigate (Principle
  /// XXXI: orchestration only).
  Future<void> uploadNationalId({
    required bool front,
    required PickedImage image,
  }) async {
    if (front ? state.idFrontUploading : state.idBackUploading) return;
    emit(front
        ? state.copyWith(idFrontUploading: true, error: null)
        : state.copyWith(idBackUploading: true, error: null));
    final res = await _auth.uploadNationalIdSide(
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
}
