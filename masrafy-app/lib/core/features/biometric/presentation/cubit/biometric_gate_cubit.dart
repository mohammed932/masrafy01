import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

import '../../../../storage/customer_session_storage.dart';
import '../../domain/biometric_auth_result.dart';
import '../../domain/biometric_service.dart';

part 'biometric_gate_state.dart';
part 'biometric_gate_cubit.freezed.dart';

/// App-wide lock gate (Principle XXXV — the one core-level cubit exception
/// to per-screen cubits, since lock state must be a single source of truth
/// shared between [BiometricGateObserver] and [BiometricLockPage]).
/// Registered as a lazy singleton in DI, not a screen-scoped factory.
class BiometricGateCubit extends Cubit<BiometricGateState> {
  BiometricGateCubit(this._biometric, this._session)
      : super(const BiometricGateState());

  final BiometricService _biometric;
  final CustomerSessionStorage _session;

  Future<bool> shouldLock() async {
    final token = await _session.readAccessToken();
    if (token == null || token.isEmpty) return false;
    return _biometric.isEnabled;
  }

  void lock() => emit(state.copyWith(status: BiometricGateStatus.locked));

  Future<void> attempt({required String reason}) async {
    emit(state.copyWith(status: BiometricGateStatus.unlocking));
    final capable = await _biometric.isDeviceCapable();
    if (!capable) {
      // Biometrics were removed at the OS level after the user enabled the
      // toggle — don't hard-lock them out of their own app for an OS change.
      await _biometric.setEnabled(false);
      emit(state.copyWith(status: BiometricGateStatus.idle));
      return;
    }
    final result = await _biometric.authenticate(reason: reason);
    emit(state.copyWith(
      status: result == BiometricAuthResult.success
          ? BiometricGateStatus.idle
          : BiometricGateStatus.failed,
    ));
  }
}
