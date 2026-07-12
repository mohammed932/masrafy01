part of 'otp.imports.dart';

/// Verify-Account screen (Figma `137:2672`). Renders the boxed OTP entry, a
/// resend countdown, an expiry/security notice, and the verify CTA over the
/// brand gradient header. Seeded from the route args (challenge + purpose +
/// the carried [SignupDraft]); on a verified SIGNUP it lands the session and
/// routes Home. One route-level widget (Principle XXXVI).
@RoutePage()
class OtpPage extends StatelessWidget {
  const OtpPage({
    super.key,
    required this.challenge,
    required this.purpose,
    this.draft,
  });

  final OtpChallengeEntity challenge;
  final OtpPurpose purpose;
  final SignupDraft? draft;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<OtpCubit>(
      create: (_) => getIt<OtpCubit>()
        ..start(challenge: challenge, purpose: purpose, draft: draft),
      child: const _OtpView(),
    );
  }
}

class _OtpView extends StatelessWidget {
  const _OtpView();

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

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);
    final topInset = MediaQuery.of(context).viewPadding.top;

    return Scaffold(
      backgroundColor: colors.bg.container,
      resizeToAvoidBottomInset: true,
      body: BlocConsumer<OtpCubit, OtpState>(
        listenWhen: (p, c) => p.status != c.status,
        listener: (ctx, state) {
          if (state.isSuccess) {
            // Profile completion already ran silently in OtpCubit and only
            // reaches success once it actually completed — so the account is
            // valid (profileComplete) and Home is always correct. A failed
            // completion surfaces via isFailure below (toast + stay on OTP to
            // retry), never landing an incomplete account on Home (Principle
            // XXXVII, narrowed v9.0.0: photo/National ID are optional and
            // collected later at loan-apply time).
            ctx.router.replaceAll([const HomeRoute()]);
          } else if (state.isFailure) {
            MasrafyToast.error(ctx, _errorMessage(l, state.error!));
          }
        },
        builder: (ctx, state) {
          final cubit = ctx.read<OtpCubit>();
          final text = MasrafyTextTheme.of(ctx);
          final expiryMinutes = (state.challenge?.expiresInSeconds ?? 300) ~/ 60;
          return CustomScrollView(
            physics: const BouncingScrollPhysics(
              parent: AlwaysScrollableScrollPhysics(),
            ),
            slivers: [
              SliverPersistentHeader(
                pinned: true,
                delegate: MasrafySliverGradientHeaderDelegate(
                  title: l.otp_title,
                  subtitle: l.otp_subtitle(state.maskedDestination),
                  expandedHeight: MasrafyGradientHeader.expandedHeightFor(
                    ctx,
                    title: l.otp_title,
                    subtitle: l.otp_subtitle(state.maskedDestination),
                    hasBack: true,
                    minHeight: 180.h,
                  ),
                  collapsedHeight: topInset + kToolbarHeight + 14,
                  onBack: () => ctx.router.maybePop(),
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
                      padding:
                          EdgeInsetsDirectional.fromSTEB(24.w, 40.h, 24.w, 30.h),
                      child: Column(
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
                                style: text.caption
                                    .copyWith(color: colors.text.placeholder),
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
                                        style: text.bodySmall.copyWith(
                                            color: colors.text.placeholder),
                                      ),
                                      TextSpan(
                                        text: _formatCountdown(
                                            state.secondsRemaining),
                                        style: text.bodySmall.bold().copyWith(
                                            color: colors.primary.main),
                                      ),
                                    ]),
                                  )
                                : GestureDetector(
                                    onTap: () => cubit.resend(
                                        Localizations.localeOf(ctx)
                                            .languageCode),
                                    child: Text(
                                      l.otp_resend_action,
                                      style: text.bodySmall.bold().copyWith(
                                          color: colors.secondary.main),
                                    ),
                                  ),
                          ),
                          Gap(15.h),
                          _ExpiryNotice(text: l.otp_expiry_notice(expiryMinutes)),
                          Gap(15.h),
                          MasrafyGradientButton(
                            label: l.otp_verify_cta,
                            isLoading: state.isBusy,
                            onPressed: state.canVerify ? cubit.verify : null,
                          ),
                          Gap(40.h),
                          Row(
                            children: [
                              Expanded(
                                  child: Divider(
                                      height: 1.h,
                                      color: colors.border.secondary)),
                              Padding(
                                padding:
                                    EdgeInsets.symmetric(horizontal: 10.w),
                                child: Text(
                                  l.otp_didnt_receive,
                                  style: text.caption.semiBold().copyWith(
                                        color: colors.primary.main,
                                        letterSpacing: 0.8,
                                      ),
                                ),
                              ),
                              Expanded(
                                  child: Divider(
                                      height: 1.h,
                                      color: colors.border.secondary)),
                            ],
                          ),
                          Gap(20.h),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                l.otp_wrong_number,
                                style: text.bodySmall
                                    .copyWith(color: colors.text.placeholder),
                              ),
                              Gap(6.w),
                              GestureDetector(
                                onTap: () => ctx.router.maybePop(),
                                child: Text(
                                  l.otp_change_phone,
                                  style: text.bodySmall.bold().copyWith(
                                      color: colors.secondary.main),
                                ),
                              ),
                            ],
                          ),
                        ],
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
}

/// Info banner: code expiry + "never share it" security note (Figma `137:2726`).
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
