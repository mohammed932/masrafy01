part of 'portal_auth_widgets.imports.dart';

/// Surface shown when the backend reports `user_disabled`. Offers a tap-to-
/// email-support action.
class PortalAccountDisabledView extends StatelessWidget {
  const PortalAccountDisabledView({super.key, this.onBack});

  final VoidCallback? onBack;

  static const String _supportEmail = 'support@masrafy.eg';

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    return ColoredBox(
      color: colors.bg.container,
      child: SafeArea(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 24.h),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (onBack != null)
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: IconButton(
                    icon: Icon(
                      Icons.arrow_back,
                      color: colors.text.primary,
                    ),
                    onPressed: onBack,
                  ),
                ),
              const Spacer(),
              Icon(Icons.block, size: 56.r, color: colors.error.main),
              Gap(16.h),
              Text(
                PortalStrings.of(context, PortalStrings.accountDisabled),
                textAlign: TextAlign.center,
                style: texts.heading4.semiBold().copyWith(
                      color: colors.text.heading,
                    ),
              ),
              Gap(8.h),
              Text(
                PortalStrings.of(context, PortalStrings.accountDisabledBody),
                textAlign: TextAlign.center,
                style: texts.body.regular().copyWith(
                      color: colors.text.secondary,
                    ),
              ),
              const Spacer(),
              SizedBox(
                height: 44.h,
                child: FilledButton.icon(
                  icon: const Icon(Icons.mail_outline),
                  label: Text(
                    PortalStrings.of(context, PortalStrings.contactSupport),
                  ),
                  onPressed: () =>
                      launchUrl(Uri.parse('mailto:$_supportEmail')),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
