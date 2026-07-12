import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/di/injection.dart';
import 'package:app/core/router/router.gr.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/widgets/buttons/masrafy_primary_button.dart';
import 'package:app/core/widgets/buttons/masrafy_secondary_button.dart';
import 'package:app/features/auth/domain/usecases/auth_usecase.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import 'cubit/biometric_gate_cubit.dart';

/// Full-screen biometric lock shown by [BiometricGateObserver]. The only
/// route-level widget in this file (Principle XXXVI). Blocks back-navigation
/// (`PopScope(canPop: false)`) — the only exits are a successful biometric
/// prompt (popped by the observer) or logging out.
///
/// The route is pushed while the app is *backgrounding* (so it covers the last
/// screen before the next foreground — no content flash). The OS biometric
/// prompt therefore must NOT fire at build time (that would run in the
/// background); instead [_maybeAttempt] fires it only once the page is actually
/// foregrounded (`resumed`) and the gate is still `locked` — from `initState`
/// for the cold-start / already-foreground push, and from the resume callback
/// for the push-on-pause case. Gating on `locked` also stops a re-fire during
/// the prompt's own self-pause→resume and avoids auto-retrying after a failure
/// (the Retry button stays the manual path).
@RoutePage()
class BiometricLockPage extends StatefulWidget {
  const BiometricLockPage({super.key});

  @override
  State<BiometricLockPage> createState() => _BiometricLockPageState();
}

class _BiometricLockPageState extends State<BiometricLockPage>
    with WidgetsBindingObserver {
  String? _reason;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeAttempt());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reason = AppLocalizations.of(context).biometric_lock_reason;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _maybeAttempt();
  }

  /// Fires the biometric prompt only when the page is genuinely foregrounded
  /// and the gate is still awaiting the first unlock.
  void _maybeAttempt() {
    if (WidgetsBinding.instance.lifecycleState != AppLifecycleState.resumed) {
      return;
    }
    final cubit = getIt<BiometricGateCubit>();
    if (cubit.state.status != BiometricGateStatus.locked) return;
    cubit.attempt(reason: _reason ?? '');
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: getIt<BiometricGateCubit>(),
      child: PopScope(
        canPop: false,
        child: _BiometricLockView(),
      ),
    );
  }
}

class _BiometricLockView extends StatelessWidget {
  const _BiometricLockView();

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: colors.bg.layout,
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 32.w),
          child: Center(
            child: BlocBuilder<BiometricGateCubit, BiometricGateState>(
              builder: (context, state) {
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.fingerprint,
                      size: 72.r,
                      color: colors.primary.main,
                    ),
                    Gap(24.h),
                    Text(
                      l.biometric_lock_title,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 18.sp,
                        fontWeight: FontWeight.w600,
                        color: colors.text.heading,
                      ),
                    ),
                    Gap(32.h),
                    if (state.status == BiometricGateStatus.failed)
                      Padding(
                        padding: EdgeInsets.only(bottom: 12.h),
                        child: MasrafyPrimaryButton(
                          label: l.biometric_lock_retry,
                          onPressed: () => context
                              .read<BiometricGateCubit>()
                              .attempt(reason: l.biometric_lock_reason),
                        ),
                      ),
                    MasrafySecondaryButton(
                      label: l.biometric_lock_logout,
                      onPressed: () => _logout(context),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _logout(BuildContext context) async {
    await getIt<AuthUseCase>().logout();
    if (!context.mounted) return;
    await context.router.replaceAll([const LoginRoute()]);
  }
}
