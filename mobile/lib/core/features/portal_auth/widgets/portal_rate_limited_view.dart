part of 'portal_auth_widgets.imports.dart';

/// Shown when backend returns HTTP 429. Displays the reset time when known
/// and a disabled-until-reset "Try again" CTA. No automatic retry.
class PortalRateLimitedView extends StatelessWidget {
  const PortalRateLimitedView({
    super.key,
    this.resetAt,
    required this.onRetry,
  });

  final DateTime? resetAt;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    final now = DateTime.now();
    final isPastReset = resetAt == null || now.isAfter(resetAt!);
    final resumeLabel = resetAt == null
        ? null
        : '${resetAt!.hour.toString().padLeft(2, '0')}:'
            '${resetAt!.minute.toString().padLeft(2, '0')}';
    return ColoredBox(
      color: colors.bg.container,
      child: SafeArea(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 24.h),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.hourglass_top_rounded,
                size: 56.r,
                color: colors.warning.main,
              ),
              Gap(16.h),
              Text(
                PortalStrings.of(context, PortalStrings.pleaseWait),
                textAlign: TextAlign.center,
                style: texts.heading4.semiBold().copyWith(
                      color: colors.text.heading,
                    ),
              ),
              if (resumeLabel != null) ...[
                Gap(8.h),
                Text(
                  resumeLabel,
                  style: texts.bodyLarge.copyWith(color: colors.text.secondary),
                ),
              ],
              Gap(24.h),
              SizedBox(
                height: 44.h,
                width: double.infinity,
                child: FilledButton(
                  onPressed: isPastReset ? onRetry : null,
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
