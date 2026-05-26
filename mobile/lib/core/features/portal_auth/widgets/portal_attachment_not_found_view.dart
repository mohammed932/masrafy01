part of 'portal_auth_widgets.imports.dart';

/// Shown when the backend returns 404 for an attachment ID.
class PortalAttachmentNotFoundView extends StatelessWidget {
  const PortalAttachmentNotFoundView({super.key, required this.onBack});

  final VoidCallback onBack;

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
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.image_not_supported_outlined,
                size: 56.r,
                color: colors.text.tertiary,
              ),
              Gap(16.h),
              Text(
                PortalStrings.of(context, PortalStrings.attachmentNotFound),
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
                  onPressed: onBack,
                  child: Text(
                    PortalStrings.of(context, PortalStrings.backToQuestion),
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
