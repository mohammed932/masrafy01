import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../di/injection.dart';
import '../../../router/router.dart';
import 'biometric_lock_trigger.dart';
import 'cubit/biometric_gate_cubit.dart';

/// Wraps the routed app to re-check the biometric lock on every resume from
/// background. Cold start is handled separately by
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
    if (state == AppLifecycleState.resumed) maybeShowBiometricLock();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: getIt<BiometricGateCubit>(),
      child: BlocListener<BiometricGateCubit, BiometricGateState>(
        listenWhen: (previous, current) =>
            previous.status != BiometricGateStatus.idle &&
            current.status == BiometricGateStatus.idle,
        listener: (context, state) => getIt<AppRouter>().maybePop(),
        child: widget.child,
      ),
    );
  }
}
