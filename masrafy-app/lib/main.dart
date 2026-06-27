import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'core/di/injection.dart';
import 'core/environments/base_environment.dart';
import 'core/locale/locale_cubit/locale_cubit.dart';
import 'core/router/router.dart';
import 'core/theme/colors/masrafy_color_theme.dart';
import 'core/theme/masrafy_ui_kit.dart';
import 'core/theme/theme_bloc/theme_bloc.dart';
import 'core/theme/typography/masrafy_text_theme.dart';
import 'l10n/generated/app_localizations.dart';

Future<void> main({BaseEnvironment? environment}) async {
  WidgetsFlutterBinding.ensureInitialized();
  await configureDependencies(environment: environment);
  runApp(const MasrafyApp());
}

class MasrafyApp extends StatelessWidget {
  const MasrafyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MasrafyUiKitInitializer(
      child: MultiBlocProvider(
        providers: [
          BlocProvider<ThemeBloc>(
            create: (_) =>
                getIt<ThemeBloc>()..add(const ThemeBlocEvent.initColorTheme()),
          ),
          BlocProvider<LocaleCubit>(
            create: (_) => getIt<LocaleCubit>()..init(),
          ),
        ],
        child: BlocBuilder<ThemeBloc, ThemeBlocState>(
          builder: (context, state) {
            final router = getIt<AppRouter>();
            return BlocBuilder<LocaleCubit, LocaleState>(
              builder: (context, localeState) => MaterialApp.router(
                title: 'Masrafy',
                debugShowCheckedModeBanner: false,
                localizationsDelegates: AppLocalizations.localizationsDelegates,
                supportedLocales: AppLocalizations.supportedLocales,
                locale: localeState.locale,
                theme: _buildTheme(const MasrafyLightTheme()),
                darkTheme: _buildTheme(const MasrafyDarkTheme()),
                themeMode: _materialThemeMode(state.mode),
                routerConfig: router.config(),
                builder: (context, child) {
                MasrafyUiKitInitializer.update(context);
                // Resolve the active theme for the InheritedWidget so
                // `MasrafyColorTheme.of(context)` matches the rendered mode
                // (and follows the OS when mode == system).
                final colors = MasrafyColorTheme.resolve(
                  state.mode,
                  MediaQuery.platformBrightnessOf(context),
                );
                return MasrafyColorThemeProvider(
                  theme: colors,
                  child: child ?? const SizedBox.shrink(),
                );
              },
              ),
            );
          },
        ),
      ),
    );
  }
}

ThemeMode _materialThemeMode(ColorThemes mode) => switch (mode) {
      ColorThemes.light => ThemeMode.light,
      ColorThemes.dark => ThemeMode.dark,
      ColorThemes.system => ThemeMode.system,
    };

/// Builds Material's [ThemeData] from a [MasrafyColorTheme] so framework
/// widgets (text fields, dialogs, ripples) stay on-brand, and registers the
/// [MasrafyTextTheme] extension consumed via `MasrafyTextTheme.of(context)`.
ThemeData _buildTheme(MasrafyColorTheme colors) {
  final scheme = ColorScheme.fromSeed(
    seedColor: colors.primary.main,
    brightness: colors.brightness,
  ).copyWith(
    primary: colors.primary.main,
    secondary: colors.secondary.main,
    error: colors.error.main,
    surface: colors.bg.container,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: colors.brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: colors.bg.layout,
    appBarTheme: AppBarTheme(
      centerTitle: true,
      backgroundColor: colors.bg.container,
      foregroundColor: colors.text.heading,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      iconTheme: IconThemeData(color: colors.icon.main),
    ),
    iconTheme: IconThemeData(color: colors.icon.main),
    dividerColor: colors.border.split,
    extensions: const [MasrafyTextTheme.standard],
  );
}
