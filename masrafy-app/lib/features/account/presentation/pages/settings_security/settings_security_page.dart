part of 'settings_security.imports.dart';

/// Settings & Security (Figma `2107:34`). A flat back-chip header over three
/// grouped sections — Privacy & Security, Notification Center, Languages — on
/// the light layout, with the shared bottom nav (Menu tab active). Reached from
/// the Account menu. The single route-level widget for this file (XXXVI).
///
/// Biometric / Notifications are UI-only mock toggles (no backend yet); Privacy
/// Policies shows a "coming soon" toast. Language tapping opens the shared
/// single-select sheet and drives the app-wide [LocaleCubit] (real RTL switch).
@RoutePage()
class SettingsSecurityPage extends StatelessWidget {
  const SettingsSecurityPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<SettingsSecurityCubit>(
      create: (_) => getIt<SettingsSecurityCubit>(),
      child: const _SettingsSecurityView(),
    );
  }
}

class _SettingsSecurityView extends StatelessWidget {
  const _SettingsSecurityView();

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);
    final cubit = context.read<SettingsSecurityCubit>();

    void soon() => MasrafyToast.info(context, l.common_coming_soon);

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
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics(),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              MasrafyBackTitleHeader(
                title: l.settings_security_title,
                onBack: () => context.router.maybePop(),
              ),
              Gap(15.h),
              Padding(
                padding: EdgeInsetsDirectional.symmetric(horizontal: 24.w),
                child: BlocBuilder<SettingsSecurityCubit, SettingsSecurityState>(
                  builder: (context, state) {
                    return Column(
                      children: [
                        SettingsSection(
                          label: l.settings_section_privacy_security,
                          children: [
                            SettingsTile(
                              icon: Icons.fingerprint,
                              iconColor: colors.error.main,
                              title: l.settings_biometric_title,
                              subtitle: l.settings_biometric_subtitle,
                              trailing: MasrafySwitch(
                                value: state.biometricEnabled,
                                onChanged: (v) => cubit.updateField(
                                  SettingsSecurityField.biometric,
                                  v,
                                ),
                              ),
                            ),
                            SettingsTile(
                              icon: Icons.shield,
                              iconColor: colors.primary.main,
                              title: l.settings_privacy_policies_title,
                              subtitle: l.settings_privacy_policies_subtitle,
                              onTap: soon,
                            ),
                          ],
                        ),
                        Gap(25.h),
                        SettingsSection(
                          label: l.settings_section_notification_center,
                          children: [
                            SettingsTile(
                              icon: Icons.notifications,
                              iconColor: colors.success.main,
                              title: l.settings_notifications_title,
                              subtitle: l.settings_notifications_subtitle,
                              trailing: MasrafySwitch(
                                value: state.notificationsEnabled,
                                onChanged: (v) => cubit.updateField(
                                  SettingsSecurityField.notifications,
                                  v,
                                ),
                              ),
                            ),
                          ],
                        ),
                        Gap(25.h),
                        SettingsSection(
                          label: l.settings_section_languages,
                          children: [
                            BlocBuilder<LocaleCubit, LocaleState>(
                              builder: (context, locale) => SettingsTile(
                                icon: Icons.language,
                                iconColor: colors.info.main,
                                title: l.settings_change_language_title,
                                subtitle: locale.languageCode == 'en'
                                    ? l.settings_language_english
                                    : l.settings_language_arabic,
                                onTap: () =>
                                    _pickLanguage(context, locale.languageCode),
                              ),
                            ),
                          ],
                        ),
                        Gap(24.h),
                      ],
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Opens the shared single-select sheet (Principle XXXIII / A36) and, on a
  /// pick, drives the app-wide [LocaleCubit] to switch + persist the language.
  Future<void> _pickLanguage(BuildContext context, String current) async {
    final l = AppLocalizations.of(context);
    final localeCubit = context.read<LocaleCubit>();
    final selected = await showMasrafySingleSelectSheet<String>(
      context: context,
      title: l.settings_language_sheet_title,
      initialValue: current,
      options: [
        MasrafySelectOption(value: 'en', label: l.settings_language_english),
        MasrafySelectOption(value: 'ar', label: l.settings_language_arabic),
      ],
    );
    if (selected != null) {
      await localeCubit.change(selected);
    }
  }
}
