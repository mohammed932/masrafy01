part of 'splash_cubit.dart';

/// Where the splash gate routes after resolving persisted state.
enum SplashDestination { onboarding, login, home }

@freezed
class SplashState with _$SplashState {
  const factory SplashState({
    SplashDestination? destination,
  }) = _SplashState;

  // ignore: unused_element
  const SplashState._();

  bool get resolved => destination != null;
}
