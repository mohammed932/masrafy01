import 'package:flutter/material.dart';

import 'core/di/injection.dart';
import 'core/environments/base_environment.dart';
import 'core/router/router.dart';
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
    final router = getIt<AppRouter>();
    return MaterialApp.router(
      title: 'Masrafy',
      debugShowCheckedModeBanner: false,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0869C3),
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: const Color(0xFFF7F8FA),
      ),
      routerConfig: router.config(),
    );
  }
}
