import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../di/injection.dart';
import '../../../router/router.dart';
import '../../../router/router.gr.dart';
import 'biometric_lock_trigger.dart';
import 'cubit/biometric_gate_cubit.dart';

/// Wraps the routed app to re-check the biometric lock when it returns from a
/// genuine background. Cold start is handled separately by
/// [BiometricColdStartObserver] (a `NavigatorObserver`, wired in `main.dart`)
/// since this widget's `initState` runs before Splash has resolved its
/// routing decision — see `biometric_lock_trigger.dart` for why both share
/// one push guard. Navigates via the [AppRouter] singleton directly (not
/// `context.router`) — this widget sits ABOVE the routed `Navigator` in the
/// tree (inside `MaterialApp.router`'s `builder`, wrapping its `child`), so
/// an InheritedWidget lookup from here can never find the router below it.
class BiometricGateObserver extends StatefulWidget {
  const BiometricGateObserver({required this.child, super.key});

  final Widget child;

  @override
  State<BiometricGateObserver> createState() => _BiometricGateObserverState();
}

class _BiometricGateObserverState extends State<BiometricGateObserver>
    with WidgetsBindingObserver {
  /// Set when the app is backgrounded for real (`paused`/`hidden`/`detached`
  /// reached while NOT mid-unlock). Only a resume that follows one of these
  /// re-locks — transient `inactive` interruptions (notification shade, app
  /// switcher peek, permission dialogs) never reach `paused`, so they don't.
  bool _wasBackgrounded = false;

  /// Set when the biometric prompt itself backgrounds the activity (on OEMs
  /// where `local_auth` runs in a separate window, e.g. Samsung): the pause
  /// happens while an attempt is in flight (`unlocking`). Its trailing resume
  /// fires AFTER a successful unlock already popped the lock and returned to
  /// Home — without this we'd read that resume as a fresh foreground and
  /// re-lock in a loop. We consume that one resume instead of re-locking.
  bool _selfPaused = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
      case AppLifecycleState.detached:
        // Distinguish our own biometric prompt (attempt in flight) from the
        // user genuinely leaving the app.
        if (getIt<BiometricGateCubit>().state.status ==
            BiometricGateStatus.unlocking) {
          _selfPaused = true;
        } else {
          _wasBackgrounded = true;
        }
      case AppLifecycleState.resumed:
        if (_selfPaused) {
          _selfPaused = false;
          return;
        }
        if (_wasBackgrounded) {
          _wasBackgrounded = false;
          maybeShowBiometricLock();
        }
      case AppLifecycleState.inactive:
        break;
    }
  }

  /// Dismisses the lock once biometrics succeed. Must force the pop:
  /// [BiometricLockPage] wraps itself in `PopScope(canPop: false)` to block
  /// back-button/gesture bypass, so `maybePop()` would be swallowed and leave
  /// the lock on screen. `popForced()` bypasses that guard and completes the
  /// awaited `push` in `maybeShowBiometricLock`, resetting its `_lockPushed`
  /// flag. Guarded so we only ever pop the lock route itself.
  void _dismissLock() {
    final router = getIt<AppRouter>();
    if (router.current.name == BiometricLockRoute.name) router.popForced();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: getIt<BiometricGateCubit>(),
      child: BlocListener<BiometricGateCubit, BiometricGateState>(
        listenWhen: (previous, current) =>
            previous.status != BiometricGateStatus.idle &&
            current.status == BiometricGateStatus.idle,
        listener: (context, state) => _dismissLock(),
        child: widget.child,
      ),
    );
  }
}
