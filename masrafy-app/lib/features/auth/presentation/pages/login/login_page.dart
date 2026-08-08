part of 'login.imports.dart';

/// Login screen (Figma `77:1032`). Gradient hero header over a white sheet
/// holding the email + password form, the gradient Sign-in CTA, social
/// providers, and create-account link. Wraps the form in [BlocProvider] so
/// [LoginCubit] is available before the fields mount (Principle XXXVI:
/// one route-level widget; private leaf helpers live below).
@RoutePage()
class LoginPage extends StatelessWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<LoginCubit>(
      create: (_) => getIt<LoginCubit>(),
      child: const _LoginView(),
    );
  }
}

class _LoginView extends StatefulWidget {
  const _LoginView();

  @override
  State<_LoginView> createState() => _LoginViewState();
}

class _LoginViewState extends State<_LoginView> {
  final _identifier = TextEditingController();
  final _password = TextEditingController();

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  String _errorMessage(AppLocalizations l, Failure f) {
    switch (f.code) {
      case 'CUSTOMER_INVALID_CREDENTIALS':
      case 'AUTH_INVALID_CREDENTIALS':
      case 'INVALID_CREDENTIALS':
        return l.error_invalid_credentials;
      case 'NETWORK_UNREACHABLE':
        return l.error_network;
      case 'SOCIAL_SIGN_IN_FAILED':
      case 'SOCIAL_TOKEN_INVALID':
        return l.auth_social_token_invalid;
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
      body: BlocConsumer<LoginCubit, LoginState>(
        listenWhen: (p, c) => p.status != c.status,
        listener: (ctx, state) {
          if (state.isSuccess) {
            final customer = state.session!.customer;
            // SOCIAL onboarding gate: an incomplete account with no verified
            // mobile goes to the phone → OTP flow first; once the mobile is
            // bound it drops straight to the Complete-Profile birthday step.
            if (customer.profileComplete) {
              ctx.router.replaceAll([MainShellRoute()]);
            } else if (customer.mobileVerifiedAt == null) {
              ctx.router.replaceAll([const SocialPhoneRoute()]);
            } else {
              ctx.router.replaceAll([CompleteProfileRoute()]);
            }
          } else if (state.isFailure) {
            MasrafyToast.error(ctx, _errorMessage(l, state.error!));
          }
        },
        builder: (ctx, state) {
          final cubit = ctx.read<LoginCubit>();
          return CustomScrollView(
            physics: const BouncingScrollPhysics(
              parent: AlwaysScrollableScrollPhysics(),
            ),
            slivers: [
              SliverPersistentHeader(
                pinned: true,
                delegate: MasrafySliverGradientHeaderDelegate(
                  title: l.login_title,
                  subtitle: l.login_subtitle,
                  expandedHeight: MasrafyGradientHeader.expandedHeightFor(
                    ctx,
                    title: l.login_title,
                    subtitle: l.login_subtitle,
                    minHeight: 180.h,
                  ),
                  collapsedHeight: topInset + kToolbarHeight + 14,
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
                      padding: EdgeInsetsDirectional.fromSTEB(24.w, 40.h, 24.w, 30.h),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _LabeledField(
                            label: l.login_identifier_label,
                            controller: _identifier,
                            hint: l.login_identifier_hint,
                            keyboardType: TextInputType.emailAddress,
                            onChanged: (v) =>
                                cubit.updateField(LoginField.identifier, v),
                          ),
                          Gap(16.h),
                          _LabeledField(
                            label: l.login_password_label,
                            controller: _password,
                            hint: l.login_password_hint,
                            obscure: state.obscure,
                            onChanged: (v) =>
                                cubit.updateField(LoginField.password, v),
                            suffix: IconButton(
                              splashRadius: 20.r,
                              icon: Icon(
                                state.obscure
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                                size: 20.r,
                                color: colors.icon.main,
                              ),
                              onPressed: cubit.toggleObscure,
                            ),
                          ),
                          Gap(10.h),
                          Align(
                            alignment: AlignmentDirectional.centerEnd,
                            child: GestureDetector(
                              onTap: () =>
                                  ctx.router.push(const ForgotPasswordRoute()),
                              child: Text(
                                l.login_forgot,
                                style: MasrafyTextTheme.of(ctx)
                                    .caption
                                    .semiBold()
                                    .copyWith(color: colors.secondary.main),
                              ),
                            ),
                          ),
                          Gap(24.h),
                          MasrafyGradientButton(
                            label: l.login_cta,
                            isLoading: state.isBusy,
                            onPressed: state.canSubmit ? cubit.submit : null,
                          ),
                          Gap(20.h),
                          MasrafyOrDivider(label: l.login_or_continue),
                          Gap(16.h),
                          // Google is the only social provider (constitution
                          // v11.0.0), so the button spans the full width.
                          MasrafySocialButton(
                            icon: Icons.g_mobiledata_rounded,
                            label: l.login_google,
                            onTap: () {
                              if (!state.isBusy) cubit.signInWithGoogle();
                            },
                          ),
                          Gap(20.h),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                l.login_no_account,
                                style: MasrafyTextTheme.of(ctx).bodySmall.copyWith(
                                      color: colors.text.placeholder,
                                    ),
                              ),
                              Gap(6.w),
                              GestureDetector(
                                onTap: () => ctx.router.push(const SignupRoute()),
                                child: Text(
                                  l.login_create_account,
                                  style: MasrafyTextTheme.of(ctx)
                                      .bodySmall
                                      .bold()
                                      .copyWith(color: colors.secondary.main),
                                ),
                              ),
                            ],
                          ),
                          Gap(16.h),
                          Text(
                            l.login_terms,
                            textAlign: TextAlign.center,
                            style: MasrafyTextTheme.of(ctx).bodySmall.copyWith(
                                  color: colors.text.placeholder,
                                ),
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

/// Uppercase label above a filled, rounded text input (Figma input style).
class _LabeledField extends StatelessWidget {
  const _LabeledField({
    required this.label,
    required this.controller,
    required this.onChanged,
    this.hint,
    this.obscure = false,
    this.keyboardType,
    this.suffix,
  });

  final String label;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final String? hint;
  final bool obscure;
  final TextInputType? keyboardType;
  final Widget? suffix;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: text.caption.semiBold().copyWith(
                color: colors.primary.main,
                letterSpacing: 0.66,
              ),
        ),
        Gap(6.h),
        TextField(
          controller: controller,
          onChanged: onChanged,
          obscureText: obscure,
          keyboardType: keyboardType,
          style: text.body.copyWith(color: colors.text.heading),
          decoration: InputDecoration(
            isDense: true,
            hintText: hint,
            hintStyle: text.body.copyWith(color: colors.text.placeholder),
            filled: true,
            fillColor: colors.bg.layout,
            suffixIcon: suffix,
            contentPadding: EdgeInsetsDirectional.symmetric(
              horizontal: 14.w,
              vertical: 14.h,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14.r),
              borderSide: BorderSide(color: colors.border.main),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14.r),
              borderSide: BorderSide(color: colors.secondary.main),
            ),
          ),
        ),
      ],
    );
  }
}
