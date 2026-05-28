import 'package:flutter/material.dart';

import 'core/di/injection.dart';
import 'core/environments/base_environment.dart';
import 'l10n/generated/app_localizations.dart';

Future<void> main({BaseEnvironment? environment}) async {
  WidgetsFlutterBinding.ensureInitialized();
  await configureDependencies(environment: environment);
  runApp(const MasrafyApp());
}

/// Root widget for the Masrafy mobile app.
///
/// Data + domain layers are fully wired (auth + wizard features), but the
/// presentation tier is intentionally absent — pages are rebuilt post-
/// Figma. The home screen is a placeholder until the first
/// `@RoutePage` lands.
class MasrafyApp extends StatelessWidget {
  const MasrafyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
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
      home: const _PresentationPendingScreen(),
    );
  }
}

class _PresentationPendingScreen extends StatelessWidget {
  const _PresentationPendingScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: const [
                Text(
                  'Masrafy',
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0869C3),
                  ),
                ),
                SizedBox(height: 12),
                Text(
                  'Data + domain layers wired.\nUI lands post-Figma.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
