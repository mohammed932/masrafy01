import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/auth/domain/usecases/customer_auth_usecase.dart';

part 'national_id_status_cubit.freezed.dart';
part 'national_id_status_state.dart';

/// Reads which National ID sides are already on file
/// (`GET /api/v1/profile/documents/status`) so the offer-details screen can
/// (a) print the real ID status in the stat grid instead of a fixed "Pending",
/// and (b) answer the Apply tap locally — warning the user BEFORE spending a
/// select-offer call that the backend would reject with `NATIONAL_ID_REQUIRED`
/// (Constitution v9.1.0).
///
/// Only the National ID matters here: the profile photo was dropped from the
/// select-offer gate in v9.1.0 and must not be re-added. Orchestration only —
/// derivations live on [NationalIdStatusState] (Principle XXXI).
@injectable
class NationalIdStatusCubit extends Cubit<NationalIdStatusState> {
  NationalIdStatusCubit(this._auth) : super(const NationalIdStatusState());

  final CustomerAuthUseCase _auth;

  /// A failed read leaves the status UNKNOWN rather than "missing": the tap
  /// then falls through to the server, which is the authority on the gate.
  /// Blocking an offline user whose ID is actually on file would be worse than
  /// letting the call fail with a typed error.
  Future<void> load() async {
    if (state.status.isLoading) return;
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _auth.profileDocumentsStatus();
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (status) => emit(state.copyWith(
        status: RequestState.loaded,
        frontUploaded: status.nationalIdFront,
        backUploaded: status.nationalIdBack,
        error: null,
      )),
    );
  }
}
