part of 'signup.imports.dart';

/// Create-Account screen (Figma `91:322`). A gradient hero over a white sheet
/// holding the full PHONE-signup form: profile photo, name, phone, email, date
/// of birth, password (+ strength), National ID, and terms. Submitting fires
/// the SMS OTP and routes to [OtpPage]. Photo + National ID capture are UI-only
/// for now (deferred). One route-level widget; private leaf helpers below
/// (Principle XXXVI).
@RoutePage()
class SignupPage extends StatelessWidget {
  const SignupPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<SignupCubit>(
      create: (_) => getIt<SignupCubit>(),
      child: const _SignupView(),
    );
  }
}

class _SignupView extends StatefulWidget {
  const _SignupView();

  @override
  State<_SignupView> createState() => _SignupViewState();
}

class _SignupViewState extends State<_SignupView> {
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
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

  Future<void> _pickBirthday(
    BuildContext context,
    SignupCubit cubit,
    DateTime? current,
  ) async {
    final now = DateTime.now();
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => MasrafySingleDatePickerSheet(
        initialDate: current ?? DateTime(now.year - 25, now.month, now.day),
        firstDate: DateTime(now.year - 80, now.month, now.day),
        lastDate: DateTime(now.year - 18, now.month, now.day),
        onDateSelected: (d) => cubit.updateField(SignupField.birthday, d),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);
    final topInset = MediaQuery.of(context).viewPadding.top;

    return Scaffold(
      backgroundColor: colors.bg.container,
      resizeToAvoidBottomInset: true,
      body: BlocConsumer<SignupCubit, SignupState>(
        listenWhen: (p, c) => p.status != c.status,
        listener: (ctx, state) {
          if (state.challengeReady) {
            ctx.router.push(
              OtpRoute(
                challenge: state.challenge!,
                purpose: OtpPurpose.signup,
                draft: state.toDraft(),
              ),
            );
          } else if (state.isFailure) {
            MasrafyToast.error(ctx, _errorMessage(l, state.error!));
          }
        },
        builder: (ctx, state) {
          final cubit = ctx.read<SignupCubit>();
          return CustomScrollView(
            physics: const BouncingScrollPhysics(
              parent: AlwaysScrollableScrollPhysics(),
            ),
            slivers: [
              SliverPersistentHeader(
                pinned: true,
                delegate: MasrafySliverGradientHeaderDelegate(
                  title: l.signup_title,
                  subtitle: l.signup_subtitle,
                  expandedHeight: MasrafyGradientHeader.expandedHeightFor(
                    ctx,
                    title: l.signup_title,
                    subtitle: l.signup_subtitle,
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
                          MasrafyPhotoUpload(
                            label: l.signup_photo_upload,
                            onTap: () =>
                                MasrafyToast.info(ctx, l.common_coming_soon),
                          ),
                          Gap(20.h),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: MasrafyLabeledField(
                                  label: l.signup_first_name_label,
                                  controller: _firstName,
                                  hint: l.signup_first_name_hint,
                                  showStatusDot: true,
                                  status: state.firstName.trim().isEmpty
                                      ? MasrafyFieldStatus.neutral
                                      : MasrafyFieldStatus.valid,
                                  textInputAction: TextInputAction.next,
                                  onChanged: (v) => cubit.updateField(
                                      SignupField.firstName, v),
                                ),
                              ),
                              Gap(10.w),
                              Expanded(
                                child: MasrafyLabeledField(
                                  label: l.signup_last_name_label,
                                  controller: _lastName,
                                  hint: l.signup_last_name_hint,
                                  showStatusDot: true,
                                  status: state.lastName.trim().isEmpty
                                      ? MasrafyFieldStatus.neutral
                                      : MasrafyFieldStatus.valid,
                                  textInputAction: TextInputAction.next,
                                  onChanged: (v) => cubit.updateField(
                                      SignupField.lastName, v),
                                ),
                              ),
                            ],
                          ),
                          Gap(16.h),
                          MasrafyPhoneField(
                            dialCode: state.dialCode,
                            onDialCodeChanged: (c) =>
                                cubit.updateField(SignupField.dialCode, c),
                            phoneNumber: state.phone,
                            onPhoneNumberChanged: (p) =>
                                cubit.updateField(SignupField.phone, p),
                            phoneCodeLabel: ' ',
                            phoneNumberLabel: l.signup_phone_label,
                            phoneNumberPlaceholder: l.signup_phone_hint,
                          ),
                          Gap(16.h),
                          MasrafyLabeledField(
                            label: l.signup_email_label,
                            controller: _email,
                            hint: l.signup_email_hint,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            showStatusDot: state.email.isNotEmpty,
                            status: state.email.isEmpty
                                ? MasrafyFieldStatus.neutral
                                : (Validators.email(state.email) == null
                                    ? MasrafyFieldStatus.valid
                                    : MasrafyFieldStatus.error),
                            onChanged: (v) =>
                                cubit.updateField(SignupField.email, v),
                          ),
                          Gap(16.h),
                          MasrafyDobSelector(
                            label: l.signup_dob_label,
                            hint: l.signup_dob_hint,
                            value: state.birthday,
                            ageVerifiedText: state.age != null
                                ? l.signup_age_verified(state.age!)
                                : null,
                            onTap: () =>
                                _pickBirthday(ctx, cubit, state.birthday),
                          ),
                          Gap(16.h),
                          MasrafyLabeledField(
                            label: l.signup_password_label,
                            controller: _password,
                            hint: l.signup_password_hint,
                            obscure: state.obscure,
                            showStatusDot: true,
                            status: state.password.isEmpty
                                ? MasrafyFieldStatus.neutral
                                : (Validators.strongPassword(state.password) ==
                                        null
                                    ? MasrafyFieldStatus.valid
                                    : MasrafyFieldStatus.error),
                            onChanged: (v) =>
                                cubit.updateField(SignupField.password, v),
                            suffix: _ObscureToggle(
                              obscured: state.obscure,
                              onTap: cubit.toggleObscure,
                            ),
                          ),
                          if (state.password.isNotEmpty) ...[
                            Gap(8.h),
                            MasrafyPasswordStrengthBar(
                                password: state.password),
                          ],
                          Gap(16.h),
                          MasrafyLabeledField(
                            label: l.signup_confirm_password_label,
                            controller: _confirm,
                            hint: l.signup_confirm_password_hint,
                            obscure: state.obscureConfirm,
                            status: state.confirmPassword.isEmpty
                                ? MasrafyFieldStatus.neutral
                                : (state.confirmPassword == state.password
                                    ? MasrafyFieldStatus.valid
                                    : MasrafyFieldStatus.error),
                            onChanged: (v) => cubit.updateField(
                                SignupField.confirmPassword, v),
                            suffix: _ObscureToggle(
                              obscured: state.obscureConfirm,
                              onTap: cubit.toggleObscureConfirm,
                            ),
                          ),
                          Gap(20.h),
                          Divider(height: 1.h, color: colors.border.secondary),
                          Gap(16.h),
                          MasrafyNationalIdUploader(
                            sectionLabel: l.signup_national_id_label,
                            sectionHint: l.signup_national_id_hint,
                            frontLabel: l.signup_id_front,
                            backLabel: l.signup_id_back,
                            frontSubtitle: l.signup_id_tap_to_upload,
                            backSubtitle: l.signup_id_tap_to_upload,
                            onTapFront: () =>
                                MasrafyToast.info(ctx, l.common_coming_soon),
                            onTapBack: () =>
                                MasrafyToast.info(ctx, l.common_coming_soon),
                          ),
                          Gap(8.h),
                          MasrafyCheckboxTile(
                            label: l.signup_terms,
                            value: state.agreedToTerms,
                            showDivider: false,
                            onChanged: (v) =>
                                cubit.updateField(SignupField.terms, v),
                          ),
                          Gap(16.h),
                          MasrafyGradientButton(
                            label: l.signup_cta,
                            isLoading: state.isBusy,
                            onPressed: state.canSubmit
                                ? () => cubit.submit(
                                    Localizations.localeOf(ctx).languageCode)
                                : null,
                          ),
                          Gap(16.h),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                l.signup_have_account,
                                style: MasrafyTextTheme.of(ctx).bodySmall.copyWith(
                                      color: colors.text.placeholder,
                                    ),
                              ),
                              Gap(6.w),
                              GestureDetector(
                                onTap: () => ctx.router.maybePop(),
                                child: Text(
                                  l.signup_sign_in,
                                  style: MasrafyTextTheme.of(ctx)
                                      .bodySmall
                                      .bold()
                                      .copyWith(color: colors.secondary.main),
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

/// Eye toggle suffix shared by the password + confirm inputs.
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
