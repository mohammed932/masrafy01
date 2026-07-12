part of 'profile_cubit.dart';

@freezed
class ProfileState with _$ProfileState {
  const factory ProfileState({
    @Default(RequestState.initial) RequestState status,
    ProfileData? data,
    Failure? error,
  }) = _ProfileState;

  // ignore: unused_element
  const ProfileState._();

  bool get isLoading => status.isLoading || status.isInitial;
  bool get isError => status.isError;
  bool get isLoaded => status.isLoaded && data != null;
}
