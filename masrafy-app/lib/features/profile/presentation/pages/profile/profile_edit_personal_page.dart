part of 'profile.imports.dart';

/// Edit Personal Info (Figma `4028:4573`). Editable avatar, first/last name,
/// date of birth, password, and National-ID uploaders. Saving pops the
/// [ProfilePersonalDraft] back to the Profile view. UI-only mock: photo +
/// National-ID capture are coming-soon stubs. Single route-level widget
/// (Principle XXXVI); seeded once from the route's [initial] slice.
@RoutePage()
class ProfileEditPersonalPage extends StatelessWidget {
  const ProfileEditPersonalPage({super.key, required this.initial});

  final ProfilePersonalDraft initial;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<ProfileEditPersonalCubit>(
      create: (_) => getIt<ProfileEditPersonalCubit>()..seed(initial),
      child: const _ProfileEditPersonalView(),
    );
  }
}

class _ProfileEditPersonalView extends StatefulWidget {
  const _ProfileEditPersonalView();

  @override
  State<_ProfileEditPersonalView> createState() =>
      _ProfileEditPersonalViewState();
}

class _ProfileEditPersonalViewState extends State<_ProfileEditPersonalView> {
  late final TextEditingController _firstName;
  late final TextEditingController _lastName;
  late final TextEditingController _password;

  @override
  void initState() {
    super.initState();
    final s = context.read<ProfileEditPersonalCubit>().state;
    _firstName = TextEditingController(text: s.firstName);
    _lastName = TextEditingController(text: s.lastName);
    _password = TextEditingController(text: s.password);
  }

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _pickBirthday(
    BuildContext context,
    ProfileEditPersonalCubit cubit,
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
        onDateSelected: cubit.setBirthday,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);
    void soon() => MasrafyToast.info(context, l.common_coming_soon);

    return Scaffold(
      backgroundColor: colors.bg.layout,
      bottomNavigationBar: MasrafyAppBottomNav(
        active: MasrafyAppNavTab.profile,
        loansLabel: l.home_nav_loans,
        profileLabel: l.home_nav_profile,
        onLoans: soon,
        onHome: () => context.router.popUntilRoot(),
        onProfile: () => context.router.maybePop(),
      ),
      body: BlocBuilder<ProfileEditPersonalCubit, ProfileEditPersonalState>(
        builder: (ctx, state) {
          final cubit = ctx.read<ProfileEditPersonalCubit>();

          return SafeArea(
            bottom: false,
            child: Column(
              children: [
                ProfileHeader(
                  title: l.profile_title,
                  onBack: () => ctx.router.maybePop(),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    physics: const BouncingScrollPhysics(
                      parent: AlwaysScrollableScrollPhysics(),
                    ),
                    padding: EdgeInsetsDirectional.fromSTEB(20.w, 16.h, 20.w, 24.h),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        ProfileAvatarEditor(onTap: soon),
                        Gap(24.h),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: MasrafyLabeledField(
                                label: l.profile_first_name,
                                controller: _firstName,
                                textInputAction: TextInputAction.next,
                                onChanged: (v) => cubit.updateField(
                                    ProfileEditPersonalField.firstName, v),
                              ),
                            ),
                            Gap(10.w),
                            Expanded(
                              child: MasrafyLabeledField(
                                label: l.profile_last_name,
                                controller: _lastName,
                                textInputAction: TextInputAction.next,
                                onChanged: (v) => cubit.updateField(
                                    ProfileEditPersonalField.lastName, v),
                              ),
                            ),
                          ],
                        ),
                        Gap(16.h),
                        MasrafyDobSelector(
                          label: l.profile_dob,
                          dayPlaceholder: l.profile_dob_day,
                          monthPlaceholder: l.profile_dob_month,
                          yearPlaceholder: l.profile_dob_year,
                          value: state.birthday,
                          onTap: () => _pickBirthday(ctx, cubit, state.birthday),
                        ),
                        Gap(16.h),
                        MasrafyLabeledField(
                          label: l.profile_password,
                          controller: _password,
                          hint: l.profile_password_hint,
                          obscure: state.obscurePassword,
                          onChanged: (v) => cubit.updateField(
                              ProfileEditPersonalField.password, v),
                          suffix: _ObscureToggle(
                            obscured: state.obscurePassword,
                            onTap: cubit.toggleObscure,
                          ),
                        ),
                        Gap(20.h),
                        MasrafyNationalIdUploader(
                          sectionLabel: l.profile_national_id,
                          sectionHint: l.profile_national_id_hint,
                          frontLabel: l.profile_id_front,
                          backLabel: l.profile_id_back,
                          frontSubtitle: state.frontUploaded
                              ? l.profile_id_uploaded
                              : l.profile_id_tap_to_upload,
                          backSubtitle: state.backUploaded
                              ? l.profile_id_uploaded
                              : l.profile_id_tap_to_upload,
                          frontUploaded: state.frontUploaded,
                          backUploaded: state.backUploaded,
                          onTapFront: soon,
                          onTapBack: soon,
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(20.w, 8.h, 20.w, 12.h),
                  child: MasrafyGradientButton(
                    label: l.profile_save,
                    onPressed: state.canSave
                        ? () => ctx.router.maybePop(cubit.state.toDraft())
                        : null,
                  ),
                ),
              ],
            ),
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
