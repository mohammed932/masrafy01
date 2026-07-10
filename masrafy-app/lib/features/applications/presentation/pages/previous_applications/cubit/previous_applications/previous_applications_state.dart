part of 'previous_applications_cubit.dart';

@freezed
class PreviousApplicationsState with _$PreviousApplicationsState {
  const factory PreviousApplicationsState({
    @Default(RequestState.initial) RequestState status,
    @Default(<PastApplication>[]) List<PastApplication> applications,
    Failure? error,
  }) = _PreviousApplicationsState;

  // ignore: unused_element
  const PreviousApplicationsState._();

  bool get isLoading => status.isLoading || status.isInitial;
  bool get isError => status.isError;
  bool get isLoaded => status.isLoaded;
  bool get isEmpty => status.isLoaded && applications.isEmpty;
}
