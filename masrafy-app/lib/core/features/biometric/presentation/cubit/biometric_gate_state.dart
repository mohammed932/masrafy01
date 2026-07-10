part of 'biometric_gate_cubit.dart';

enum BiometricGateStatus { idle, locked, unlocking, failed }

@freezed
class BiometricGateState with _$BiometricGateState {
  const factory BiometricGateState({
    @Default(BiometricGateStatus.idle) BiometricGateStatus status,
  }) = _BiometricGateState;
}
