/// Runtime configuration per build flavor.
///
/// Backend reads `MOBILE_CLIENT_ID` and `MOBILE_CLIENT_SECRET` from its env;
/// the mobile client must use matching values. In production the secret
/// MUST be loaded from `flutter_secure_storage` (Constitution Principle
/// XXVIII / A23) — for the dev flavor we read from compile-time `--dart-define`
/// so the simulator can boot without a key-provisioning ceremony.
class EnvConfig {
  const EnvConfig({
    required this.baseUrl,
    required this.hmacClientId,
    required this.hmacSecret,
    required this.isProduction,
  });

  factory EnvConfig.dev() => const EnvConfig(
        // Android emulator → host loopback. iOS simulator can use localhost.
        baseUrl: String.fromEnvironment(
          'MASRAFY_BASE_URL',
          defaultValue: 'http://10.0.2.2:3000',
        ),
        hmacClientId: String.fromEnvironment(
          'MASRAFY_HMAC_CLIENT_ID',
          defaultValue: 'dev',
        ),
        hmacSecret: String.fromEnvironment(
          'MASRAFY_HMAC_SECRET',
          defaultValue:
              '21794af201ec4b75463cfb31f865867eb6154df74efb45ab2a6bf9cd68b6e019',
        ),
        isProduction: false,
      );

  factory EnvConfig.prod() => const EnvConfig(
        baseUrl: String.fromEnvironment(
          'MASRAFY_BASE_URL',
          defaultValue: 'https://api.masrafy.eg',
        ),
        // Production MUST be injected from secure storage — fail loud if the
        // build forgot to pass --dart-define so we never ship a known secret.
        hmacClientId: String.fromEnvironment('MASRAFY_HMAC_CLIENT_ID'),
        hmacSecret: String.fromEnvironment('MASRAFY_HMAC_SECRET'),
        isProduction: true,
      );

  final String baseUrl;
  final String hmacClientId;
  final String hmacSecret;
  final bool isProduction;
}
