part of 'phone_verification.imports.dart';

/// Mobile-entry screen. Reached from post-login and from the splash gate
/// whenever the signed-in account is profile-incomplete with no verified phone
/// (Principle XIII / XXXVII) — path-agnostic, keyed on `mobileVerifiedAt`.
/// Collects the mobile number over the shared brand
/// gradient header; on submit it issues the SMS OTP and pushes the shared OTP
/// screen with [OtpPurpose.profileMobile]. One route-level widget (Principle
/// XXXVI); the phone-binding flow continues on the OTP screen.
@RoutePage()
class PhoneVerificationPage extends StatelessWidget {
  const PhoneVerificationPage({super.key, this.pendingMobile});

  /// Number this account already submitted for verification without finishing
  /// the OTP (backend `pendingMobile`). Prefills the field so a returning
  /// customer does not retype it; submitting still issues a fresh OTP.
  final String? pendingMobile;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PhoneVerificationCubit>(
      create: (_) => getIt<PhoneVerificationCubit>()..seedPhone(pendingMobile),
      child: const _PhoneVerificationView(),
    );
  }
}

class _PhoneVerificationView extends StatelessWidget {
  const _PhoneVerificationView();

  /// Drops the half-registered session and returns to Login.
  Future<void> _abandon(BuildContext context) async {
    await getIt<AuthUseCase>().logout();
    if (!context.mounted) return;
    await context.router.replaceAll([const LoginRoute()]);
  }

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
    final topInset = MediaQuery.viewPaddingOf(context).top;
    final collapsedHeight = topInset + kToolbarHeight + 14;
    // Read ABOVE the Scaffold: resizeToAvoidBottomInset strips viewInsets.bottom
    // from its body's MediaQuery, so nothing below it can see the keyboard.
    final kbProgress = MasrafyKeyboardInset.progressForInset(
      MediaQuery.viewInsetsOf(context).bottom,
    );

    // System back takes the same exit as the header chip — otherwise it would
    // close the app on this root route while a half-registered session lingers.
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _abandon(context);
      },
      child: Scaffold(
        backgroundColor: colors.bg.container,
        resizeToAvoidBottomInset: true,
        body: BlocConsumer<PhoneVerificationCubit, PhoneVerificationState>(
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
            final cubit = ctx.read<PhoneVerificationCubit>();
            final text = MasrafyTextTheme.of(ctx);
            return CustomScrollView(
              physics: const BouncingScrollPhysics(
                parent: AlwaysScrollableScrollPhysics(),
              ),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              slivers: [
                SliverPersistentHeader(
                  pinned: true,
                  delegate: MasrafySliverGradientHeaderDelegate(
                    title: l.phone_verification_title,
                    subtitle: l.phone_verification_subtitle,
                    expandedHeight: MasrafyGradientHeader.expandedHeightFor(
                      ctx,
                      title: l.phone_verification_title,
                      subtitle: l.phone_verification_subtitle,
                      hasBack: true,
                      minHeight: 180.h,
                    ),
                    collapsedHeight: collapsedHeight,
                    // Collapses the hero toward the compact toolbar as the
                    // keyboard rises, handing the height back to the form.
                    keyboardProgress: kbProgress,
                    // Reached via replaceAll from both login and the splash gate,
                    // so there is nothing to pop. Back = abandon the half-finished
                    // registration: clear the session, then Login. Without the
                    // logout the splash gate would route straight back here on the
                    // next launch and the button would read as broken.
                    onBack: () => _abandon(ctx),
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
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              l.phone_verification_title,
                              style: text.caption.semiBold().copyWith(
                                    color: colors.primary.main,
                                    letterSpacing: 0.9,
                                  ),
                            ),
                            Gap(16.h),
                            MasrafyPhoneField(
                              dialCode: state.dialCode,
                              onDialCodeChanged: (c) => cubit.updateField(
                                  PhoneVerificationField.dialCode, c),
                              phoneNumber: state.phone,
                              onPhoneNumberChanged: (p) => cubit.updateField(
                                  PhoneVerificationField.phone, p),
                              phoneCodeLabel: ' ',
                              phoneNumberLabel: l.signup_phone_label,
                              phoneNumberPlaceholder: l.signup_phone_hint,
                            ),
                            Gap(28.h),
                            MasrafyGradientButton(
                              label: l.phone_verification_cta,
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
      ),
    );
  }
}
