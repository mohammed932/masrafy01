part of 'onboarding_cubit.dart';

@freezed
class OnboardingState with _$OnboardingState {
  const factory OnboardingState({
    @Default(0) int pageIndex,
    @Default(3) int totalPages,
    @Default(false) bool completed,
  }) = _OnboardingState;

  // ignore: unused_element
  const OnboardingState._();

  bool get isLastPage => pageIndex >= totalPages - 1;
}
