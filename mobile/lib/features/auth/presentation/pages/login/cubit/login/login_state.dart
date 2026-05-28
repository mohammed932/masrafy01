part of 'login_cubit.dart';

enum LoginField { phone, password }

@freezed
class LoginState with _$LoginState {
  const factory LoginState({
    @Default('') String phone,
    @Default('') String password,
    @Default(RequestState.initial) RequestState status,
    Failure? error,
    CustomerSessionEntity? session,
  }) = _LoginState;

  // ignore: unused_element
  const LoginState._();

  bool get canSubmit =>
      phone.isNotEmpty && password.isNotEmpty && !status.isLoading;

  bool get isBusy => status.isLoading;
  bool get isSuccess => status.isLoaded && session != null;
  bool get isFailure => status.isError && error != null;
}
