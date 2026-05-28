/// Runtime configuration per build flavor.
///
/// Constitution v3.0.0 (Principle XIII) removed HMAC-SHA256 request signing
/// platform-wide. Mobile auth is now customer JWT only — bearer access
/// token (15 min) + refresh token (30 d) stored in `flutter_secure_storage`.
/// No shared secrets ship with the client.
class EnvConfig {
  const EnvConfig({
    required this.baseUrl,
    required this.isProduction,
  });

  factory EnvConfig.dev() => const EnvConfig(
        // Android emulator → host loopback. iOS simulator can use localhost.
        baseUrl: String.fromEnvironment(
          'MASRAFY_BASE_URL',
          defaultValue: 'http://10.0.2.2:3000',
        ),
        isProduction: false,
      );

  factory EnvConfig.prod() => const EnvConfig(
        baseUrl: String.fromEnvironment(
          'MASRAFY_BASE_URL',
          defaultValue: 'https://api.masrafy.eg',
        ),
        isProduction: true,
      );

  final String baseUrl;
  final bool isProduction;
}
