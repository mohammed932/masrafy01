import '../../../di/injection.dart';
import '../../../router/router.dart';
import '../../../router/router.gr.dart';
import 'cubit/biometric_gate_cubit.dart';

bool _lockPushed = false;

/// Pushes [BiometricLockRoute] if a session exists and biometric login is
/// enabled; a safe no-op otherwise. Called from two independent triggers —
/// [BiometricColdStartObserver] (first landing after Splash) and
/// [BiometricGateObserver] (resume from background) — so the "already
/// pushed" guard lives here, not duplicated per-caller, to prevent a double
/// push if both fire close together.
Future<void> maybeShowBiometricLock() async {
  final cubit = getIt<BiometricGateCubit>();
  if (!await cubit.shouldLock()) return;
  if (_lockPushed) return;
  cubit.lock();
  _lockPushed = true;
  await getIt<AppRouter>().push(const BiometricLockRoute());
  _lockPushed = false;
}
