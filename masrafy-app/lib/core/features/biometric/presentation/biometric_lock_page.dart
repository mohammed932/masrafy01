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
@RoutePage()
class BiometricLockPage extends StatelessWidget {
  const BiometricLockPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return BlocProvider.value(
      value: getIt<BiometricGateCubit>()
        ..attempt(reason: l.biometric_lock_reason),
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
