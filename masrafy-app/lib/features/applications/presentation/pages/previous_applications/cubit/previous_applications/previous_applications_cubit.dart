import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/applications/domain/usecases/applications_usecase.dart';
import 'package:app/features/applications/presentation/models/previous_applications_args.dart';

part 'previous_applications_cubit.freezed.dart';
part 'previous_applications_state.dart';

/// "Applications" screen state (Figma `4088:296`). Loads the customer's own
/// applications from the backend (shimmer while loading, Principle XXXIV) and
/// maps each [ApplicationSummaryEntity] to the existing [PastApplication]
/// shape so [PastApplicationCard] renders unchanged. Orchestration only; data
/// shape lives on the state (Principle XXXI).
@injectable
class PreviousApplicationsCubit extends Cubit<PreviousApplicationsState> {
  PreviousApplicationsCubit(this._useCase)
      : super(const PreviousApplicationsState());

  final ApplicationsUseCase _useCase;

  Future<void> load() async {
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _useCase.list();
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (entities) => emit(state.copyWith(
        status: RequestState.loaded,
        applications: entities.map(PastApplication.fromEntity).toList(),
        error: null,
      )),
    );
  }
}
