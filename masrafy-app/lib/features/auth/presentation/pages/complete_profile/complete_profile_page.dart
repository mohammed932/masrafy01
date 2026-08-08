part of 'complete_profile.imports.dart';

/// Mandatory Complete-Profile screen (Principle XXXVII). A gradient hero over a
/// white sheet collecting the photo, name, date of birth, password (PHONE only)
/// and National ID front/back — each upload runs immediately, and the gradient
/// CTA submits the scalar fields to flip `profileComplete`, then enters Home.
/// One route-level widget; private leaf helpers below (Principle XXXVI).
@RoutePage()
class CompleteProfilePage extends StatelessWidget {
  const CompleteProfilePage({super.key, this.draft});

  /// Optional PHONE-signup draft used to prefill the form (null for the SOCIAL
  /// path and for a returning login with an incomplete profile).
  final SignupDraft? draft;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<CompleteProfileCubit>(
      create: (_) => getIt<CompleteProfileCubit>()
        ..seed(draft)
        ..load(),
      child: const _CompleteProfileView(),
    );
  }
}

class _CompleteProfileView extends StatefulWidget {
  const _CompleteProfileView();

  @override
  State<_CompleteProfileView> createState() => _CompleteProfileViewState();
}

class _CompleteProfileViewState extends State<_CompleteProfileView> {
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _password = TextEditingController();

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _password.dispose();
    super.dispose();
  }

  String _errorMessage(AppLocalizations l, Failure f) {
    switch (f.code) {
      case 'NETWORK_UNREACHABLE':
        return l.error_network;
      case 'IMAGE_TOO_LARGE':
        return l.error_image_too_large;
      default:
        return l.error_generic;
    }
  }

  Future<void> _pickBirthday(
    BuildContext context,
    CompleteProfileCubit cubit,
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
        onDateSelected: (d) =>
            cubit.updateField(CompleteProfileField.birthday, d),
      ),
    );
  }

  /// Navigation stays on the screen (Principle XXXI): the page opens the framed
  /// camera, the cubit only uploads what comes back.
  Future<void> _captureAndUploadId(
    BuildContext context,
    CompleteProfileCubit cubit, {
    required bool front,
  }) async {
    final image = await captureNationalId(context, front: front);
    if (image == null) return;
    await cubit.uploadNationalId(front: front, image: image);
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);
    final topInset = MediaQuery.of(context).viewPadding.top;

    return Scaffold(
      backgroundColor: colors.bg.container,
      resizeToAvoidBottomInset: true,
      body: BlocConsumer<CompleteProfileCubit, CompleteProfileState>(
        listenWhen: (p, c) =>
            p.status != c.status ||
            p.error != c.error ||
            p.loadStatus != c.loadStatus,
        listener: (ctx, state) {
          if (state.loadStatus.isLoaded && _firstName.text.isEmpty) {
            _firstName.text = state.firstName;
            _lastName.text = state.lastName;
            _password.text = state.password;
          }
          if (state.isSuccess) {
            ctx.router.replaceAll([MainShellRoute()]);
          } else if (state.error != null) {
            MasrafyToast.error(ctx, _errorMessage(l, state.error!));
          }
        },
        builder: (ctx, state) {
          final cubit = ctx.read<CompleteProfileCubit>();
          return CustomScrollView(
            physics: const BouncingScrollPhysics(
              parent: AlwaysScrollableScrollPhysics(),
            ),
            slivers: [
              SliverPersistentHeader(
                pinned: true,
                delegate: MasrafySliverGradientHeaderDelegate(
                  title: l.auth_complete_profile_title,
                  subtitle: l.auth_complete_profile_body,
                  expandedHeight: MasrafyGradientHeader.expandedHeightFor(
                    ctx,
                    title: l.auth_complete_profile_title,
                    subtitle: l.auth_complete_profile_body,
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
                      padding:
                          EdgeInsetsDirectional.fromSTEB(24.w, 40.h, 24.w, 30.h),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          MasrafyPhotoUpload(
                            label: l.signup_photo_upload,
                            imageBytes: state.photoBytes,
                            uploading: state.photoUploading,
                            uploaded: state.photoUploaded,
                            onTap: cubit.pickAndUploadPhoto,
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
                                      CompleteProfileField.firstName, v),
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
                                      CompleteProfileField.lastName, v),
                                ),
                              ),
                            ],
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
                          if (state.requiresPassword) ...[
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
                              onChanged: (v) => cubit.updateField(
                                  CompleteProfileField.password, v),
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
                          ],
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
                            frontUploaded: state.idFrontUploaded,
                            backUploaded: state.idBackUploaded,
                            onTapFront: state.idFrontUploading
                                ? null
                                : () => _captureAndUploadId(ctx, cubit,
                                    front: true),
                            onTapBack: state.idBackUploading
                                ? null
                                : () => _captureAndUploadId(ctx, cubit,
                                    front: false),
                          ),
                          Gap(24.h),
                          MasrafyGradientButton(
                            label: l.auth_complete_profile_action_complete,
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

/// Eye toggle suffix for the password input.
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
