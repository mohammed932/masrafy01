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
      create: (_) => getIt<ProfileEditPersonalCubit>()
        ..seed(initial)
        ..loadDocumentsStatus(),
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

  @override
  void initState() {
    super.initState();
    final s = context.read<ProfileEditPersonalCubit>().state;
    _firstName = TextEditingController(text: s.firstName);
    _lastName = TextEditingController(text: s.lastName);
  }

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
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

  Future<void> _pickPhoto(
    BuildContext context,
    ProfileEditPersonalCubit cubit,
  ) async {
    final l = AppLocalizations.of(context);
    final source = await MasrafyPhotoSourceSheet.show(
      context,
      title: l.photo_source_title,
      cameraLabel: l.photo_source_camera,
      galleryLabel: l.photo_source_gallery,
    );
    if (source == null) return;
    await cubit.pickAndUploadPhoto(source);
  }

  /// Maps a save [Failure] code to a localized message (Principle III — never
  /// show a raw backend string). Mirrors the change-password error mapper.
  String _saveError(AppLocalizations l, Failure f) {
    switch (f.code) {
      case 'CUSTOMER_EMAIL_ALREADY_REGISTERED':
        return l.profile_email_taken;
      case 'PROFILE_FIELD_IMMUTABLE':
        return l.auth_profile_field_immutable;
      case 'AGE_INVALID':
        return l.auth_age_invalid;
      case 'NETWORK_UNREACHABLE':
        return l.error_network;
      default:
        return l.profile_save_failed;
    }
  }

  /// Upload errors: distinguish offline from the generic per-asset fallback.
  String _uploadError(AppLocalizations l, Failure f, String fallback) =>
      f.code == 'NETWORK_UNREACHABLE' ? l.error_network : fallback;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: colors.bg.layout,
      bottomNavigationBar: MasrafyAppBottomNav(
        active: MasrafyAppNavTab.menu,
        loansLabel: l.home_nav_loans,
        homeLabel: l.home_nav_home,
        menuLabel: l.home_nav_menu,
        onLoans: () =>
            context.router.replace(SavedOffersRoute(fromTab: true)),
        onHome: () => context.router.replaceAll([const HomeRoute()]),
        onMenu: () => context.router.maybePop(),
      ),
      body: BlocConsumer<ProfileEditPersonalCubit, ProfileEditPersonalState>(
        listenWhen: (p, c) =>
            (p.photoError != c.photoError && c.photoError != null) ||
            (p.docError != c.docError && c.docError != null) ||
            (p.saveError != c.saveError && c.saveError != null) ||
            (!p.saved && c.saved),
        listener: (ctx, state) {
          if (state.photoError != null) {
            MasrafyToast.error(ctx, _uploadError(l, state.photoError!, l.profile_photo_upload_failed));
          } else if (state.docError != null) {
            MasrafyToast.error(ctx, _uploadError(l, state.docError!, l.profile_id_upload_failed));
          } else if (state.saveError != null) {
            MasrafyToast.error(ctx, _saveError(l, state.saveError!));
          } else if (state.saved) {
            MasrafyToast.success(ctx, l.profile_save_success);
            ctx.router.maybePop(ctx.read<ProfileEditPersonalCubit>().state.toDraft());
          }
        },
        builder: (ctx, state) {
          final cubit = ctx.read<ProfileEditPersonalCubit>();

          return SafeArea(
            bottom: false,
            child: Column(
              children: [
                MasrafyBackTitleHeader(
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
                        Center(
                          child: ProfileAvatarEditor(
                            imageUrl: state.photoUrl,
                            imageBytes: state.photoBytes,
                            uploading: state.photoUploading,
                            onTap: () => _pickPhoto(ctx, cubit),
                          ),
                        ),
                        Gap(24.h),
                        ProfileFormSection(
                          title: l.profile_section_personal,
                          children: [
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
                            MasrafyDobSelector(
                              label: l.profile_dob,
                              hint: l.profile_dob_hint,
                              value: state.birthday,
                              // Birthday is immutable once set (Principle
                              // XXXVII) — lock it when already present.
                              enabled: state.birthday == null,
                              ageVerifiedText: state.birthday != null
                                  ? l.profile_dob_locked
                                  : null,
                              onTap: () =>
                                  _pickBirthday(ctx, cubit, state.birthday),
                            ),
                          ],
                        ),
                        Gap(20.h),
                        ProfileFormSection(
                          children: [
                            MasrafyNationalIdUploader(
                              sectionLabel: l.profile_national_id,
                              sectionHint: l.profile_national_id_hint,
                              frontLabel: l.profile_id_front,
                              backLabel: l.profile_id_back,
                              frontSubtitle: state.frontUploading
                                  ? l.profile_id_uploading
                                  : state.frontUploaded
                                      ? l.profile_id_uploaded
                                      : l.profile_id_tap_to_upload,
                              backSubtitle: state.backUploading
                                  ? l.profile_id_uploading
                                  : state.backUploaded
                                      ? l.profile_id_uploaded
                                      : l.profile_id_tap_to_upload,
                              frontUploaded: state.frontUploaded,
                              backUploaded: state.backUploaded,
                              onTapFront: () =>
                                  cubit.pickAndUploadNationalId(front: true),
                              onTapBack: () =>
                                  cubit.pickAndUploadNationalId(front: false),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(20.w, 8.h, 20.w, 12.h),
                  child: MasrafyGradientButton(
                    label: l.profile_save,
                    isLoading: state.saving,
                    onPressed: state.canSave ? cubit.save : null,
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
