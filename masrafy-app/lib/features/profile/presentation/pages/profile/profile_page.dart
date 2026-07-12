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
      create: (_) => getIt<ProfileCubit>()..load(),
      child: const _ProfileView(),
    );
  }
}

class _ProfileView extends StatelessWidget {
  const _ProfileView();

  Future<void> _editPersonal(
    BuildContext ctx,
    ProfileCubit cubit,
    ProfileData data,
  ) async {
    final draft = await ctx.router.push<ProfilePersonalDraft>(
      ProfileEditPersonalRoute(initial: data.toPersonalDraft()),
    );
    if (draft != null) cubit.applyPersonal(draft);
  }

  Future<void> _editContact(
    BuildContext ctx,
    ProfileCubit cubit,
    ProfileData data,
  ) async {
    final draft = await ctx.router.push<ProfileContactDraft>(
      ProfileEditContactRoute(initial: data.toContactDraft()),
    );
    if (draft != null) cubit.applyContact(draft);
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
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MasrafyBackTitleHeader(
              title: l.profile_title,
              onBack: () => context.router.maybePop(),
            ),
            Expanded(
              child: BlocBuilder<ProfileCubit, ProfileState>(
                builder: (ctx, state) {
                  final cubit = ctx.read<ProfileCubit>();
                  if (state.isLoading) return const _ProfileShimmer();
                  if (state.isError || state.data == null) {
                    return MasrafyFetchErrorState(onRetry: cubit.load);
                  }
                  return _ProfileBody(data: state.data!, cubit: cubit, view: this);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Loaded profile content — avatar + Personal Information and Contact Details
/// cards. Rows the backend has no source for (National ID, password-changed,
/// address) are intentionally omitted.
class _ProfileBody extends StatelessWidget {
  const _ProfileBody({
    required this.data,
    required this.cubit,
    required this.view,
  });

  final ProfileData data;
  final ProfileCubit cubit;
  final _ProfileView view;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toString();
    final dob = DateFormat('d MMMM y', locale).format(data.birthday);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(
        parent: AlwaysScrollableScrollPhysics(),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Gap(8.h),
          Center(
            child: MasrafyAvatar(
              size: 104.r,
              imageUrl: data.photoUrl,
              imageBytes: data.photoBytes,
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
                  onEdit: () => view._editPersonal(context, cubit, data),
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
                      label: l.profile_dob,
                      value: dob,
                      showDivider: false,
                    ),
                  ],
                ),
                Gap(20.h),
                ProfileInfoCard(
                  title: l.profile_section_contact,
                  editLabel: l.profile_edit,
                  onEdit: () => view._editContact(context, cubit, data),
                  rows: [
                    ProfileFieldRow(
                      label: l.profile_phone,
                      value: '${data.dialCode} ${data.phone}',
                    ),
                    ProfileFieldRow(
                      label: l.profile_email,
                      value: data.email,
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
    );
  }
}

/// Shape-matched loading skeleton mirroring the loaded layout (Principle
/// XXXIV) — avatar circle + two info cards.
class _ProfileShimmer extends StatelessWidget {
  const _ProfileShimmer();

  @override
  Widget build(BuildContext context) {
    return MasrafyShimmer(
      child: SingleChildScrollView(
        physics: const NeverScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Gap(8.h),
            Center(child: MasrafyShimmerCircle(diameter: 104)),
            Gap(24.h),
            Padding(
              padding: EdgeInsetsDirectional.symmetric(horizontal: 20.w),
              child: Column(
                children: [
                  _ShimmerCard(rows: 3),
                  Gap(20.h),
                  _ShimmerCard(rows: 2),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ShimmerCard extends StatelessWidget {
  const _ShimmerCard({required this.rows});

  final int rows;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return Container(
      padding: EdgeInsetsDirectional.all(17.w),
      decoration: BoxDecoration(
        color: colors.bg.container,
        borderRadius: BorderRadius.circular(15.r),
        border: Border.all(color: colors.border.secondary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasrafyShimmerBox(width: 160, height: 14, radius: 6),
          Gap(18.h),
          for (var i = 0; i < rows; i++) ...[
            MasrafyShimmerBox(width: 90, height: 11, radius: 6),
            Gap(8.h),
            MasrafyShimmerBox(width: 180, height: 14, radius: 6),
            if (i < rows - 1) Gap(16.h),
          ],
        ],
      ),
    );
  }
}
