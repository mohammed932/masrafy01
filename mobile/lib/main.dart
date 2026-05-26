import 'package:flutter/material.dart';

import 'core/di/injection.dart';
import 'core/router/router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await configureDependencies(prod: false);
  runApp(const MasrafyApp());
}

/// Root widget for the Masrafy mobile app.
///
/// Bootstrapping wires DI (`get_it`), Dio + HMAC + customer-JWT
/// interceptors, secure-storage session persistence, the auth feature
/// (data/domain/presentation), and the `auto_route` registry (login →
/// dashboard placeholder). Constitution Principle XXVIII layout.
class MasrafyApp extends StatelessWidget {
  const MasrafyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final router = getIt<AppRouter>();
    return MaterialApp.router(
      title: 'Masrafy',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF06152D),
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: const Color(0xFFF7F8FA),
      ),
      routerConfig: router.config(),
    );
  }
}
