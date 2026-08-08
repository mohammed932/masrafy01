import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/features/platform_enumerations/domain/entities/platform_enumeration_entity.dart';
import 'package:app/core/features/platform_enumerations/domain/usecases/platform_enumerations_usecase.dart';

part 'home_cubit.freezed.dart';
part 'home_state.dart';

/// Home / loan-type selection (Figma `100:1503`). Tracks the chosen loan
/// category AND the catalog program name asked for under it — the pair the
/// backend narrows the matched programs by. The four categories are static
/// design data (constitution-locked, Principle II); the program names are
/// operator-managed registry DATA, so they are fetched.
///
/// Orchestration only (Principle XXXI) — the "which names apply to the selected
/// category" question lives on the state.
@injectable
class HomeCubit extends Cubit<HomeState> {
  HomeCubit(this._enums) : super(const HomeState());

  final PlatformEnumerationsUseCase _enums;

  /// Loads the whole `program_name` catalog once and filters per category on
  /// the state. One read rather than four: the payload is small, cached 5
  /// minutes server-side, and each member already carries the categories it is
  /// offered under — re-fetching on every card tap would show a spinner in
  /// place of a list the app already has.
  Future<void> loadProgramNames() async {
    if (state.programsStatus == RequestState.loading) return;
    emit(state.copyWith(programsStatus: RequestState.loading));
    final res = await _enums.byType(EnumerationTypes.programName);
    res.fold(
      // No blocking error surface: a catalog the app cannot read must not trap
      // the customer on Home. The picker disappears and the request goes out
      // category-only, which is what the app did before the catalog existed.
      (_) => emit(state.copyWith(
        programsStatus: RequestState.error,
        programs: const [],
      )),
      (list) => emit(state.copyWith(
        programsStatus: RequestState.loaded,
        programs: list,
      )),
    );
  }

  /// Picking a different category invalidates the program pick: a name is
  /// offered UNDER categories, and carrying the old key into the new category
  /// would send a pair the backend rejects with
  /// `PROGRAM_NAME_KEY_NOT_IN_CATEGORY`.
  ///
  /// Rebuilt rather than `copyWith`ed — freezed reads a `null` argument as
  /// "leave unchanged", so `copyWith(programKey: null)` would silently keep the
  /// stale key, which is exactly the bug this clears.
  void selectCategory(HomeLoanCategory category) => emit(
        HomeState(
          selected: category,
          programs: state.programs,
          programsStatus: state.programsStatus,
        ),
      );

  void selectProgram(String programKey) =>
      emit(state.copyWith(programKey: programKey));
}
