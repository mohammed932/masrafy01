part of 'social_phone.imports.dart';

/// SOCIAL onboarding — mobile-entry screen. Reached after a Google/Apple
/// sign-in returns a profile-incomplete lite account with no verified phone
/// (Principle XIII / XXXVII). Collects the mobile number over the shared brand
/// gradient header; on submit it issues the SMS OTP and pushes the shared OTP
/// screen with [OtpPurpose.profileMobile]. One route-level widget (Principle
/// XXXVI); the phone-binding flow continues on the OTP screen.
@RoutePage()
class SocialPhonePage extends StatelessWidget {
  const SocialPhonePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<SocialPhoneCubit>(
      create: (_) => getIt<SocialPhoneCubit>(),
      child: const _SocialPhoneView(),
    );
  }
}

class _SocialPhoneView extends StatelessWidget {
  const _SocialPhoneView();

  String _errorMessage(AppLocalizations l, Failure f) {
    switch (f.code) {
      case 'CUSTOMER_PHONE_ALREADY_REGISTERED':
        return l.auth_phone_already_registered;
      case 'OTP_RATE_LIMITED':
        return l.auth_otp_rate_limited;
      case 'NETWORK_UNREACHABLE':
        return l.error_network;
      default:
        return l.error_generic;
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
      body: BlocConsumer<SocialPhoneCubit, SocialPhoneState>(
        listenWhen: (p, c) => p.status != c.status,
        listener: (ctx, state) {
          if (state.challengeReady) {
            ctx.router.push(
              OtpRoute(
                challenge: state.challenge!,
                purpose: OtpPurpose.profileMobile,
                phone: state.fullPhone,
              ),
            );
          } else if (state.isFailure) {
            MasrafyToast.error(ctx, _errorMessage(l, state.error!));
          }
        },
        builder: (ctx, state) {
          final cubit = ctx.read<SocialPhoneCubit>();
          final text = MasrafyTextTheme.of(ctx);
          return CustomScrollView(
            physics: const BouncingScrollPhysics(
              parent: AlwaysScrollableScrollPhysics(),
            ),
            slivers: [
              SliverPersistentHeader(
                pinned: true,
                delegate: MasrafySliverGradientHeaderDelegate(
                  title: l.social_phone_title,
                  subtitle: l.social_phone_subtitle,
                  expandedHeight: MasrafyGradientHeader.expandedHeightFor(
                    ctx,
                    title: l.social_phone_title,
                    subtitle: l.social_phone_subtitle,
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
                          Text(
                            l.social_phone_title,
                            style: text.caption.semiBold().copyWith(
                                  color: colors.primary.main,
                                  letterSpacing: 0.9,
                                ),
                          ),
                          Gap(16.h),
                          MasrafyPhoneField(
                            dialCode: state.dialCode,
                            onDialCodeChanged: (c) =>
                                cubit.updateField(SocialPhoneField.dialCode, c),
                            phoneNumber: state.phone,
                            onPhoneNumberChanged: (p) =>
                                cubit.updateField(SocialPhoneField.phone, p),
                            phoneCodeLabel: ' ',
                            phoneNumberLabel: l.signup_phone_label,
                            phoneNumberPlaceholder: l.signup_phone_hint,
                          ),
                          Gap(28.h),
                          MasrafyGradientButton(
                            label: l.social_phone_cta,
                            isLoading: state.isBusy,
                            onPressed: state.canSubmit ? cubit.submit : null,
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
