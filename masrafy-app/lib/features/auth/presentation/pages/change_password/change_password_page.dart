part of 'change_password.imports.dart';

/// Change-Password screen (Settings & Security → under Biometric login). Three
/// obscured fields — current, new, confirm — with a strength bar under the new
/// password and a gradient Save CTA. On success the backend has revoked every
/// session (tokens already cleared in the usecase), so the user is sent back to
/// Login to sign in with the new password. One route-level widget; private leaf
/// helpers below (Principle XXXVI).
@RoutePage()
class ChangePasswordPage extends StatelessWidget {
  const ChangePasswordPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<ChangePasswordCubit>(
      create: (_) => getIt<ChangePasswordCubit>(),
      child: const _ChangePasswordView(),
    );
  }
}

class _ChangePasswordView extends StatefulWidget {
  const _ChangePasswordView();

  @override
  State<_ChangePasswordView> createState() => _ChangePasswordViewState();
}

class _ChangePasswordViewState extends State<_ChangePasswordView> {
  final _current = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirm = TextEditingController();

  @override
  void dispose() {
    _current.dispose();
    _newPassword.dispose();
    _confirm.dispose();
    super.dispose();
  }

  String _errorMessage(AppLocalizations l, Failure f) {
    switch (f.code) {
      case 'CUSTOMER_INVALID_CREDENTIALS':
        return l.change_password_error_current_incorrect;
      case 'PASSWORD_SAME_AS_OLD':
        return l.change_password_error_same_as_old;
      case 'PASSWORD_CHANGE_FORBIDDEN_FOR_SOCIAL':
        return l.change_password_error_social_forbidden;
      case 'PASSWORD_BREACHED':
        return l.change_password_error_breached;
      case 'PASSWORD_ON_COMMON_LIST':
        return l.change_password_error_common;
      case 'PASSWORD_BREACH_CHECK_UNAVAILABLE':
        return l.change_password_error_breach_check_unavailable;
      case 'PASSWORD_TOO_SHORT':
      case 'PASSWORD_TOO_LONG':
        return l.change_password_error_policy;
      case 'CUSTOMER_ACCOUNT_INACTIVE':
        return l.change_password_error_account_inactive;
      case 'RATE_LIMITED':
        return l.error_rate_limited;
      case 'NETWORK_UNREACHABLE':
        return l.error_network;
      default:
        return l.error_generic;
    }
  }

  MasrafyFieldStatus _statusFor(String value, bool valid) {
    if (value.isEmpty) return MasrafyFieldStatus.neutral;
    return valid ? MasrafyFieldStatus.valid : MasrafyFieldStatus.error;
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: colors.bg.layout,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MasrafyBackTitleHeader(
              title: l.change_password_title,
              onBack: () => context.router.maybePop(),
            ),
            Expanded(
              child: BlocConsumer<ChangePasswordCubit, ChangePasswordState>(
                listenWhen: (p, c) =>
                    p.status != c.status || p.error != c.error,
                listener: (ctx, state) {
                  if (state.isSuccess) {
                    MasrafyToast.success(ctx, l.change_password_success);
                    ctx.router.replaceAll([const LoginRoute()]);
                  } else if (state.error != null) {
                    MasrafyToast.error(ctx, _errorMessage(l, state.error!));
                  }
                },
                builder: (ctx, state) {
                  final cubit = ctx.read<ChangePasswordCubit>();
                  final newValid =
                      Validators.strongPassword(state.newPassword) == null &&
                          state.newPassword.length >= 12;
                  return SingleChildScrollView(
                    physics: const BouncingScrollPhysics(
                      parent: AlwaysScrollableScrollPhysics(),
                    ),
                    padding: EdgeInsetsDirectional.fromSTEB(24.w, 8.h, 24.w, 30.h),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Gap(8.h),
                        Text(
                          l.change_password_hint,
                          style: TextStyle(
                            fontSize: 13.sp,
                            height: 1.5,
                            color: colors.text.description,
                          ),
                        ),
                        Gap(24.h),
                        MasrafyLabeledField(
                          label: l.change_password_current_label,
                          controller: _current,
                          hint: l.change_password_current_hint,
                          obscure: state.obscureCurrent,
                          status: _statusFor(
                            state.currentPassword,
                            state.currentPassword.isNotEmpty,
                          ),
                          textInputAction: TextInputAction.next,
                          onChanged: (v) => cubit.updateField(
                              ChangePasswordField.currentPassword, v),
                          suffix: _ObscureToggle(
                            obscured: state.obscureCurrent,
                            onTap: () => cubit.toggleObscure(
                                ChangePasswordField.currentPassword),
                          ),
                        ),
                        Gap(16.h),
                        MasrafyLabeledField(
                          label: l.change_password_new_label,
                          controller: _newPassword,
                          hint: l.change_password_new_hint,
                          obscure: state.obscureNew,
                          showStatusDot: true,
                          status: _statusFor(state.newPassword, newValid),
                          textInputAction: TextInputAction.next,
                          onChanged: (v) => cubit.updateField(
                              ChangePasswordField.newPassword, v),
                          suffix: _ObscureToggle(
                            obscured: state.obscureNew,
                            onTap: () => cubit
                                .toggleObscure(ChangePasswordField.newPassword),
                          ),
                        ),
                        if (state.newPassword.isNotEmpty) ...[
                          Gap(8.h),
                          MasrafyPasswordStrengthBar(password: state.newPassword),
                        ],
                        Gap(16.h),
                        MasrafyLabeledField(
                          label: l.change_password_confirm_label,
                          controller: _confirm,
                          hint: l.change_password_confirm_hint,
                          obscure: state.obscureConfirm,
                          showStatusDot: true,
                          status: _statusFor(
                            state.confirmPassword,
                            state.confirmPassword.isNotEmpty &&
                                state.confirmPassword == state.newPassword,
                          ),
                          helperText: state.confirmPassword.isNotEmpty &&
                                  state.confirmPassword != state.newPassword
                              ? l.change_password_error_mismatch
                              : null,
                          textInputAction: TextInputAction.done,
                          onChanged: (v) => cubit.updateField(
                              ChangePasswordField.confirmPassword, v),
                          suffix: _ObscureToggle(
                            obscured: state.obscureConfirm,
                            onTap: () => cubit.toggleObscure(
                                ChangePasswordField.confirmPassword),
                          ),
                        ),
                        Gap(28.h),
                        MasrafyGradientButton(
                          label: l.change_password_action,
                          isLoading: state.isBusy,
                          onPressed: state.canSubmit ? cubit.submit : null,
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Eye toggle suffix for a password input.
class _ObscureToggle extends StatelessWidget {
  const _ObscureToggle({required this.obscured, required this.onTap});

  final bool obscured;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return IconButton(
      splashRadius: 20.r,
      icon: Icon(
        obscured ? Icons.visibility_off_outlined : Icons.visibility_outlined,
        size: 20.r,
        color: colors.icon.main,
      ),
      onPressed: onTap,
    );
  }
}
