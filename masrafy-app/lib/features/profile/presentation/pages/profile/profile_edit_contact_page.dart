part of 'profile.imports.dart';

/// Edit Contact Details (Figma `4028:4690`). Phone, email, and an address block
/// (governorate picker + city + address line). Saving pops the
/// [ProfileContactDraft] back to the Profile view. Single route-level widget
/// (Principle XXXVI); seeded once from the route's [initial] slice.
@RoutePage()
class ProfileEditContactPage extends StatelessWidget {
  const ProfileEditContactPage({super.key, required this.initial});

  final ProfileContactDraft initial;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<ProfileEditContactCubit>(
      create: (_) => getIt<ProfileEditContactCubit>()..seed(initial),
      child: const _ProfileEditContactView(),
    );
  }
}

class _ProfileEditContactView extends StatefulWidget {
  const _ProfileEditContactView();

  @override
  State<_ProfileEditContactView> createState() =>
      _ProfileEditContactViewState();
}

class _ProfileEditContactViewState extends State<_ProfileEditContactView> {
  late final TextEditingController _email;
  late final TextEditingController _city;
  late final TextEditingController _address;

  @override
  void initState() {
    super.initState();
    final s = context.read<ProfileEditContactCubit>().state;
    _email = TextEditingController(text: s.email);
    _city = TextEditingController(text: s.city);
    _address = TextEditingController(text: s.address);
  }

  @override
  void dispose() {
    _email.dispose();
    _city.dispose();
    _address.dispose();
    super.dispose();
  }

  /// Maps a save [Failure] code to a localized message (Principle III).
  String _saveError(AppLocalizations l, Failure f) {
    switch (f.code) {
      case 'CUSTOMER_EMAIL_ALREADY_REGISTERED':
        return l.profile_email_taken;
      case 'NETWORK_UNREACHABLE':
        return l.error_network;
      default:
        return l.profile_save_failed;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: colors.bg.layout,
      bottomNavigationBar:
          const MasrafyShellNavBar(active: MasrafyAppNavTab.menu),
      body: BlocConsumer<ProfileEditContactCubit, ProfileEditContactState>(
        listenWhen: (p, c) =>
            (p.saveError != c.saveError && c.saveError != null) ||
            (!p.saved && c.saved),
        listener: (ctx, state) {
          if (state.saveError != null) {
            MasrafyToast.error(ctx, _saveError(l, state.saveError!));
          } else if (state.saved) {
            MasrafyToast.success(ctx, l.profile_save_success);
            ctx.router.maybePop(ctx.read<ProfileEditContactCubit>().state.toDraft());
          }
        },
        builder: (ctx, state) {
          final cubit = ctx.read<ProfileEditContactCubit>();
          final isArabic = l.localeName.startsWith('ar');

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
                    child: ProfileFormSection(
                      title: l.profile_section_contact,
                      children: [
                        _ReadOnlyPhoneField(
                          label: l.profile_phone,
                          value: '${state.dialCode} ${state.phone}'.trim(),
                          lockedHint: l.profile_phone_readonly,
                        ),
                        MasrafyLabeledField(
                          label: l.profile_email,
                          controller: _email,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          onChanged: (v) => cubit.updateField(
                              ProfileEditContactField.email, v),
                        ),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: MasrafySelectField<String>(
                                label: l.profile_governorate,
                                hint: l.profile_governorate,
                                sheetTitle: l.profile_governorate,
                                dense: true,
                                showSearch: true,
                                searchHint: l.profile_search_hint,
                                value: state.governorate,
                                options: [
                                  for (final g in state.governorates)
                                    MasrafySelectOption(
                                      value: g.key,
                                      label: g.label(isArabic: isArabic),
                                    ),
                                ],
                                onSelected: (v) => cubit.updateField(
                                    ProfileEditContactField.governorate, v),
                              ),
                            ),
                            Gap(10.w),
                            Expanded(
                              child: MasrafyLabeledField(
                                label: l.profile_city,
                                controller: _city,
                                textInputAction: TextInputAction.next,
                                onChanged: (v) => cubit.updateField(
                                    ProfileEditContactField.city, v),
                              ),
                            ),
                          ],
                        ),
                        MasrafyLabeledField(
                          label: l.profile_address,
                          controller: _address,
                          textInputAction: TextInputAction.done,
                          onChanged: (v) => cubit.updateField(
                              ProfileEditContactField.address, v),
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

/// Read-only phone display for the contact editor — the phone number is
/// immutable for PHONE accounts (Principle XIII), so it is shown locked with a
/// short hint rather than an editable field. Private leaf helper (Principle XXXVI).
class _ReadOnlyPhoneField extends StatelessWidget {
  const _ReadOnlyPhoneField({
    required this.label,
    required this.value,
    required this.lockedHint,
  });

  final String label;
  final String value;
  final String lockedHint;

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
        Gap(8.h),
        Container(
          height: 44.h,
          padding: EdgeInsetsDirectional.symmetric(horizontal: 12.w),
          decoration: BoxDecoration(
            color: colors.bg.containerDisabled,
            border: Border.all(color: colors.border.main),
            borderRadius: BorderRadius.circular(14.r),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: text.body.copyWith(color: colors.text.secondary),
                ),
              ),
              Gap(8.w),
              Icon(
                Icons.lock_outline_rounded,
                size: 20.r,
                color: colors.text.tertiary,
              ),
            ],
          ),
        ),
        Gap(4.h),
        Padding(
          padding: EdgeInsetsDirectional.only(start: 2.w),
          child: Text(
            lockedHint,
            style: text.bodySmall.regular().copyWith(color: colors.text.tertiary),
          ),
        ),
      ],
    );
  }
}
