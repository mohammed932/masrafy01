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
      body: BlocBuilder<ProfileEditContactCubit, ProfileEditContactState>(
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
                        MasrafyPhoneField(
                          dialCode: state.dialCode,
                          onDialCodeChanged: (c) => cubit.updateField(
                              ProfileEditContactField.dialCode, c),
                          phoneNumber: state.phone,
                          onPhoneNumberChanged: (p) => cubit.updateField(
                              ProfileEditContactField.phone, p),
                          phoneCodeLabel: ' ',
                          phoneNumberLabel: l.profile_phone,
                          phoneNumberPlaceholder: l.profile_phone_hint,
                          uppercaseLabels: true,
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
                                  for (final g in EgyptGovernorates.all)
                                    MasrafySelectOption(
                                      value: g.slug,
                                      label: g.label(isArabic),
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
