part of 'portal_auth_widgets.imports.dart';

/// Shown when the WebView fails to load due to no network or a transient
/// network error. Provides a "Try again" CTA that re-runs the handshake.
class PortalOfflineView extends StatelessWidget {
  const PortalOfflineView({
    super.key,
    required this.onRetry,
    this.networkError = false,
  });

  final VoidCallback onRetry;

  /// When true, render the slightly more generic "couldn't reach server"
  /// copy instead of the offline copy. Useful for the network-error variant.
  final bool networkError;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    final messageKey =
        networkError ? PortalStrings.networkError : PortalStrings.offline;
    return ColoredBox(
      color: colors.bg.container,
      child: SafeArea(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 24.h),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.wifi_off_rounded,
                size: 56.r,
                color: colors.text.tertiary,
              ),
              Gap(16.h),
              Text(
                PortalStrings.of(context, messageKey),
                textAlign: TextAlign.center,
                style: texts.heading4.semiBold().copyWith(
                      color: colors.text.heading,
                    ),
              ),
              Gap(24.h),
              SizedBox(
                height: 44.h,
                width: double.infinity,
                child: FilledButton(
                  onPressed: onRetry,
                  child: Text(
                    PortalStrings.of(context, PortalStrings.tryAgain),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
