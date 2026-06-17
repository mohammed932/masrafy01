part of 'profile.imports.dart';

/// Profile view (Figma `4028:4449`). A plain back-chip header over the avatar
/// and two read-only cards — Personal Information + Contact Details — each with
/// its own azure "Edit" link that pushes the matching editor and merges the
/// returned draft. UI-only mock (see plan); the single route-level widget for
/// this file (Principle XXXVI).
@RoutePage()
class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<ProfileCubit>(
      create: (_) => getIt<ProfileCubit>(),
      child: const _ProfileView(),
    );
  }
}

class _ProfileView extends StatelessWidget {
  const _ProfileView();

  Future<void> _editPersonal(BuildContext ctx, ProfileCubit cubit) async {
    final draft = await ctx.router.push<ProfilePersonalDraft>(
      ProfileEditPersonalRoute(initial: cubit.state.toPersonalDraft()),
    );
    if (draft != null) cubit.applyPersonal(draft);
  }

  Future<void> _editContact(BuildContext ctx, ProfileCubit cubit) async {
    final draft = await ctx.router.push<ProfileContactDraft>(
      ProfileEditContactRoute(initial: cubit.state.toContactDraft()),
    );
    if (draft != null) cubit.applyContact(draft);
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);
    void soon() => MasrafyToast.info(context, l.common_coming_soon);

    return Scaffold(
      backgroundColor: colors.bg.layout,
      bottomNavigationBar: MasrafyAppBottomNav(
        active: MasrafyAppNavTab.menu,
        loansLabel: l.home_nav_loans,
        menuLabel: l.home_nav_menu,
        onLoans: soon,
        onHome: () => context.router.popUntilRoot(),
        onMenu: () => context.router.maybePop(),
      ),
      body: BlocBuilder<ProfileCubit, ProfileData>(
        builder: (ctx, data) {
          final cubit = ctx.read<ProfileCubit>();
          final locale = Localizations.localeOf(ctx).toString();
          final dob = DateFormat('d MMMM y', locale).format(data.birthday);
          final months = data.passwordChangedMonthsAgo;

          return SafeArea(
            bottom: false,
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(
                parent: AlwaysScrollableScrollPhysics(),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  MasrafyBackTitleHeader(
                    title: l.profile_title,
                    onBack: () => ctx.router.maybePop(),
                  ),
                  Gap(8.h),
                  Center(
                    child: MasrafyAvatar(
                      size: 104.r,
                      imageUrl: data.photoUrl,
                      borderColor: colors.secondary.main.withValues(alpha: 0.4),
                      borderWidth: 2,
                    ),
                  ),
                  Gap(24.h),
                  Padding(
                    padding: EdgeInsetsDirectional.symmetric(horizontal: 20.w),
                    child: Column(
                      children: [
                        ProfileInfoCard(
                          title: l.profile_section_personal,
                          editLabel: l.profile_edit,
                          onEdit: () => _editPersonal(ctx, cubit),
                          rows: [
                            ProfileFieldRow(
                              label: l.profile_first_name,
                              value: data.firstName,
                            ),
                            ProfileFieldRow(
                              label: l.profile_last_name,
                              value: data.lastName,
                            ),
                            ProfileFieldRow(
                              label: l.profile_password,
                              value: l.profile_password_changed(months),
                            ),
                            ProfileFieldRow(
                              label: l.profile_dob,
                              value: dob,
                            ),
                            ProfileFieldRow(
                              label: l.profile_national_id,
                              value: data.nationalId,
                              showDivider: false,
                            ),
                          ],
                        ),
                        Gap(20.h),
                        ProfileInfoCard(
                          title: l.profile_section_contact,
                          editLabel: l.profile_edit,
                          onEdit: () => _editContact(ctx, cubit),
                          rows: [
                            ProfileFieldRow(
                              label: l.profile_phone,
                              value: '${data.dialCode} ${data.phone}',
                            ),
                            ProfileFieldRow(
                              label: l.profile_email,
                              value: data.email,
                            ),
                            ProfileFieldRow(
                              label: l.profile_address,
                              value: [data.address, data.city]
                                  .where((s) => s.trim().isNotEmpty)
                                  .join(', '),
                              showDivider: false,
                            ),
                          ],
                        ),
                        Gap(24.h),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
