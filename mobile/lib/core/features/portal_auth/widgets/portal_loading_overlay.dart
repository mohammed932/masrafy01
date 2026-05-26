part of 'portal_auth_widgets.imports.dart';

/// Pilot-branded full-screen loading overlay shown above the WebView until
/// the hosted page reports `AUTH_READY`. Fades out via [AnimatedOpacity].
class PortalLoadingOverlay extends StatelessWidget {
  const PortalLoadingOverlay({super.key, required this.visible});

  final bool visible;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    return IgnorePointer(
      ignoring: !visible,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        opacity: visible ? 1 : 0,
        child: ColoredBox(
          color: colors.bg.container,
          child: const Center(child: LoadingWidget()),
        ),
      ),
    );
  }
}
