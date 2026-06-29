part of 'splash.imports.dart';

/// Startup gate screen. Renders the brand wordmark over the brand gradient
/// while [SplashCubit] resolves the destination, then `replaceAll`s to
/// Onboarding / Login / Home. UI-only (Principle XXXVI); decision logic
/// lives in the cubit.
@RoutePage()
class SplashPage extends StatelessWidget {
  const SplashPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<SplashCubit>(
      create: (_) => getIt<SplashCubit>()..decide(),
      child: const _SplashView(),
    );
  }
}

class _SplashView extends StatelessWidget {
  const _SplashView();

  void _go(BuildContext context, SplashDestination destination) {
    switch (destination) {
      case SplashDestination.onboarding:
        context.router.replaceAll([const OnboardingRoute()]);
      case SplashDestination.login:
        context.router.replaceAll([const LoginRoute()]);
      case SplashDestination.home:
        context.router.replaceAll([const HomeRoute()]);
      case SplashDestination.completeProfile:
        context.router.replaceAll([const CompleteProfileRoute()]);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return Scaffold(
      body: BlocListener<SplashCubit, SplashState>(
        listenWhen: (p, c) => !p.resolved && c.resolved,
        listener: (ctx, state) => _go(ctx, state.destination!),
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: AlignmentDirectional.topStart,
              end: AlignmentDirectional.bottomEnd,
              stops: const [0, 0.6, 1],
              colors: [
                Color.lerp(colors.primary.active, Colors.black, 0.4)!,
                colors.primary.main,
                colors.secondary.main,
              ],
            ),
          ),
          child: Center(
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 700),
              curve: Curves.easeOutCubic,
              builder: (context, t, child) => Opacity(
                opacity: t.clamp(0.0, 1.0),
                child: Transform.scale(
                  scale: 0.85 + (0.15 * t),
                  child: child,
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Masrafy',
                    style: text.heading1.bold().copyWith(color: colors.white),
                  ),
                  Gap(24.h),
                  SizedBox(
                    width: 26.r,
                    height: 26.r,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: colors.white.withValues(alpha: 0.85),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
