part of 'forgot_password.imports.dart';

/// Forgot-Password screen (PHONE/OTP, Principle XIII). A single route-level
/// widget hosting three internal steps (phone → OTP → new password) under one
/// collapsing gradient hero; the body cross-fades between steps. On a
/// successful reset the backend revokes all sessions and the user is sent back
/// to Login. One route-level widget; private leaf helpers below (Principle
/// XXXVI).
@RoutePage()
class ForgotPasswordPage extends StatelessWidget {
  const ForgotPasswordPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<ForgotPasswordCubit>(
      create: (_) => getIt<ForgotPasswordCubit>(),
      child: const _ForgotPasswordView(),
    );
  }
}

class _ForgotPasswordView extends StatefulWidget {
  const _ForgotPasswordView();

  @override
  State<_ForgotPasswordView> createState() => _ForgotPasswordViewState();
}

class _ForgotPasswordViewState extends State<_ForgotPasswordView> {
  final _newPassword = TextEditingController();
  final _confirm = TextEditingController();

  @override
  void dispose() {
    _newPassword.dispose();
    _confirm.dispose();
    super.dispose();
  }

  String _errorMessage(AppLocalizations l, Failure f) {
    switch (f.code) {
      case 'OTP_INVALID':
        return l.auth_otp_invalid;
      case 'OTP_EXPIRED':
        return l.auth_otp_expired;
      case 'OTP_CONSUMED':
        return l.auth_otp_consumed;
      case 'OTP_ATTEMPTS_EXCEEDED':
        return l.auth_otp_attempts_exceeded;
      case 'OTP_RATE_LIMITED':
        return l.auth_otp_rate_limited;
      case 'VERIFIED_MOBILE_TOKEN_INVALID':
        return l.auth_verified_mobile_token_invalid;
      case 'VERIFIED_MOBILE_TOKEN_EXPIRED':
        return l.auth_verified_mobile_token_expired;
      case 'VERIFIED_MOBILE_TOKEN_CONSUMED':
        return l.auth_verified_mobile_token_consumed;
      case 'RESET_UNAVAILABLE':
        return l.forgot_password_error_unavailable;
      case 'PASSWORD_BREACHED':
        return l.change_password_error_breached;
      case 'PASSWORD_ON_COMMON_LIST':
        return l.change_password_error_common;
      case 'PASSWORD_BREACH_CHECK_UNAVAILABLE':
        return l.change_password_error_breach_check_unavailable;
      case 'PASSWORD_TOO_SHORT':
      case 'PASSWORD_TOO_LONG':
        return l.change_password_error_policy;
      case 'RATE_LIMITED':
        return l.error_rate_limited;
      case 'NETWORK_UNREACHABLE':
        return l.error_network;
      default:
        return l.error_generic;
    }
  }

  String _formatCountdown(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  String _title(AppLocalizations l, ForgotPasswordStep step) {
    switch (step) {
      case ForgotPasswordStep.phone:
        return l.forgot_password_phone_title;
      case ForgotPasswordStep.otp:
        return l.forgot_password_otp_title;
      case ForgotPasswordStep.newPassword:
        return l.forgot_password_new_title;
    }
  }

  String _subtitle(
    AppLocalizations l,
    ForgotPasswordStep step,
    String masked,
  ) {
    switch (step) {
      case ForgotPasswordStep.phone:
        return l.forgot_password_phone_subtitle;
      case ForgotPasswordStep.otp:
        return l.otp_subtitle(masked);
      case ForgotPasswordStep.newPassword:
        return l.forgot_password_new_subtitle;
    }
  }

  void _onBack(BuildContext ctx, ForgotPasswordStep step) {
    if (step == ForgotPasswordStep.otp) {
      ctx.read<ForgotPasswordCubit>().backToPhone();
    } else {
      ctx.router.maybePop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);
    final topInset = MediaQuery.of(context).viewPadding.top;

    return Scaffold(
      backgroundColor: colors.bg.container,
      resizeToAvoidBottomInset: true,
      body: BlocConsumer<ForgotPasswordCubit, ForgotPasswordState>(
        listenWhen: (p, c) => p.status != c.status || p.error != c.error,
        listener: (ctx, state) {
          if (state.isSuccess) {
            MasrafyToast.success(ctx, l.forgot_password_success);
            ctx.router.replaceAll([const LoginRoute()]);
          } else if (state.isFailure) {
            MasrafyToast.error(ctx, _errorMessage(l, state.error!));
          }
        },
        builder: (ctx, state) {
          final title = _title(l, state.step);
          final subtitle = _subtitle(l, state.step, state.maskedDestination);
          return CustomScrollView(
            physics: const BouncingScrollPhysics(
              parent: AlwaysScrollableScrollPhysics(),
            ),
            slivers: [
              SliverPersistentHeader(
                pinned: true,
                delegate: MasrafySliverGradientHeaderDelegate(
                  title: title,
                  subtitle: subtitle,
                  expandedHeight: MasrafyGradientHeader.expandedHeightFor(
                    ctx,
                    title: title,
                    subtitle: subtitle,
                    hasBack: true,
                    minHeight: 180.h,
                  ),
                  collapsedHeight: topInset + kToolbarHeight + 14,
                  onBack: () => _onBack(ctx, state.step),
                ),
              ),
              SliverToBoxAdapter(
                child: Transform.translate(
                  offset: Offset(0, -28.h),
                  child: Container(
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: colors.bg.container,
                      borderRadius: BorderRadiusDirectional.only(
                        topStart: Radius.circular(28.r),
                        topEnd: Radius.circular(28.r),
                      ),
                    ),
                    child: Padding(
                      padding: EdgeInsetsDirectional.fromSTEB(
                          24.w, 40.h, 24.w, 30.h),
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 250),
                        child: _buildStep(state),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildStep(ForgotPasswordState state) {
    switch (state.step) {
      case ForgotPasswordStep.phone:
        return _PhoneStep(key: const ValueKey('phone'), state: state);
      case ForgotPasswordStep.otp:
        return _OtpStep(
          key: const ValueKey('otp'),
          state: state,
          formatCountdown: _formatCountdown,
        );
      case ForgotPasswordStep.newPassword:
        return _NewPasswordStep(
          key: const ValueKey('newPassword'),
          state: state,
          newController: _newPassword,
          confirmController: _confirm,
        );
    }
  }
}

/// Step 1 — enter the phone number that receives the reset OTP.
class _PhoneStep extends StatelessWidget {
  const _PhoneStep({super.key, required this.state});

  final ForgotPasswordState state;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final colors = MasrafyColorTheme.of(context);
    final cubit = context.read<ForgotPasswordCubit>();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l.forgot_password_phone_hint,
          style: TextStyle(
            fontSize: 13.sp,
            height: 1.5,
            color: colors.text.description,
          ),
        ),
        Gap(24.h),
        MasrafyPhoneField(
          uppercaseLabels: true,
          dialCode: state.dialCode,
          onDialCodeChanged: cubit.updateDialCode,
          phoneNumber: state.phone,
          onPhoneNumberChanged: cubit.updatePhone,
          phoneCodeLabel: ' ',
          phoneNumberLabel: l.signup_phone_label,
          phoneNumberPlaceholder: l.signup_phone_hint,
        ),
        Gap(28.h),
        MasrafyGradientButton(
          label: l.forgot_password_send_cta,
          isLoading: state.isBusy,
          onPressed: state.canSendCode
              ? () =>
                  cubit.sendCode(Localizations.localeOf(context).languageCode)
              : null,
        ),
      ],
    );
  }
}

/// Step 2 — enter the 6-digit SMS code (mirrors the OTP verify screen).
class _OtpStep extends StatelessWidget {
  const _OtpStep({
    super.key,
    required this.state,
    required this.formatCountdown,
  });

  final ForgotPasswordState state;
  final String Function(int) formatCountdown;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final cubit = context.read<ForgotPasswordCubit>();
    final expiryMinutes = (state.challenge?.expiresInSeconds ?? 300) ~/ 60;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              l.otp_enter_code,
              style: text.caption.semiBold().copyWith(
                    color: colors.primary.main,
                    letterSpacing: 0.9,
                  ),
            ),
            Text(
              l.otp_attempts_left(state.attemptsLeft),
              style:
                  text.caption.copyWith(color: colors.text.placeholder),
            ),
          ],
        ),
        Gap(12.h),
        OtpCodeField(
          value: state.code,
          hasError: state.isFailure,
          onChanged: cubit.updateCode,
        ),
        Gap(14.h),
        Center(
          child: state.secondsRemaining > 0
              ? Text.rich(
                  TextSpan(children: [
                    TextSpan(
                      text: '${l.otp_resend_in} ',
                      style: text.bodySmall
                          .copyWith(color: colors.text.placeholder),
                    ),
                    TextSpan(
                      text: formatCountdown(state.secondsRemaining),
                      style: text.bodySmall
                          .bold()
                          .copyWith(color: colors.primary.main),
                    ),
                  ]),
                )
              : GestureDetector(
                  onTap: () => cubit
                      .resend(Localizations.localeOf(context).languageCode),
                  child: Text(
                    l.otp_resend_action,
                    style: text.bodySmall
                        .bold()
                        .copyWith(color: colors.secondary.main),
                  ),
                ),
        ),
        Gap(15.h),
        _ExpiryNotice(text: l.otp_expiry_notice(expiryMinutes)),
        Gap(20.h),
        MasrafyGradientButton(
          label: l.otp_verify_cta,
          isLoading: state.isBusy,
          onPressed: state.canVerify ? cubit.verifyCode : null,
        ),
      ],
    );
  }
}

/// Step 3 — set the new password (new + confirm, strength bar).
class _NewPasswordStep extends StatelessWidget {
  const _NewPasswordStep({
    super.key,
    required this.state,
    required this.newController,
    required this.confirmController,
  });

  final ForgotPasswordState state;
  final TextEditingController newController;
  final TextEditingController confirmController;

  MasrafyFieldStatus _statusFor(String value, bool valid) {
    if (value.isEmpty) return MasrafyFieldStatus.neutral;
    return valid ? MasrafyFieldStatus.valid : MasrafyFieldStatus.error;
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final colors = MasrafyColorTheme.of(context);
    final cubit = context.read<ForgotPasswordCubit>();
    final newValid = Validators.strongPassword(state.newPassword) == null &&
        state.newPassword.length >= 12;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l.forgot_password_new_hint,
          style: TextStyle(
            fontSize: 13.sp,
            height: 1.5,
            color: colors.text.description,
          ),
        ),
        Gap(24.h),
        MasrafyLabeledField(
          label: l.change_password_new_label,
          controller: newController,
          hint: l.change_password_new_hint,
          obscure: state.obscureNew,
          showStatusDot: true,
          status: _statusFor(state.newPassword, newValid),
          textInputAction: TextInputAction.next,
          onChanged: cubit.updateNewPassword,
          suffix: _ObscureToggle(
            obscured: state.obscureNew,
            onTap: cubit.toggleObscureNew,
          ),
        ),
        if (state.newPassword.isNotEmpty) ...[
          Gap(8.h),
          MasrafyPasswordStrengthBar(password: state.newPassword),
        ],
        Gap(16.h),
        MasrafyLabeledField(
          label: l.change_password_confirm_label,
          controller: confirmController,
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
          onChanged: cubit.updateConfirmPassword,
          suffix: _ObscureToggle(
            obscured: state.obscureConfirm,
            onTap: cubit.toggleObscureConfirm,
          ),
        ),
        Gap(28.h),
        MasrafyGradientButton(
          label: l.forgot_password_reset_cta,
          isLoading: state.isBusy,
          onPressed: state.canSubmit ? cubit.submit : null,
        ),
      ],
    );
  }
}

/// Info banner: code expiry + "never share it" security note.
class _ExpiryNotice extends StatelessWidget {
  const _ExpiryNotice({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 11.h),
      decoration: BoxDecoration(
        color: colors.info.main.withValues(alpha: 0.06),
        border: Border.all(color: colors.info.main.withValues(alpha: 0.25)),
        borderRadius: BorderRadius.circular(12.r),
      ),
      child: Text(
        text,
        style: texts.caption.regular().copyWith(color: colors.text.secondary),
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
