part of 'onboarding.imports.dart';

/// First-launch onboarding carousel (Figma `71:256` / `71:188` / `71:221`).
/// Swipeable slides over a fixed stepper + action area: slides 1-2 show
/// Next / Skip, the final slide shows Sign in + social providers. Skip or
/// Sign in marks onboarding complete and routes to Login. Single route-level
/// widget (Principle XXXVI); private leaf helpers live below.
@RoutePage()
class OnboardingPage extends StatelessWidget {
  const OnboardingPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<OnboardingCubit>(
      create: (_) => getIt<OnboardingCubit>(),
      child: const _OnboardingView(),
    );
  }
}

class _OnboardingView extends StatefulWidget {
  const _OnboardingView();

  @override
  State<_OnboardingView> createState() => _OnboardingViewState();
}

class _OnboardingViewState extends State<_OnboardingView> {
  final _controller = PageController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _next() => _controller.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);
    final slides = onboardingSlidesData(l);

    return Scaffold(
      backgroundColor: colors.bg.layout,
      body: BlocConsumer<OnboardingCubit, OnboardingState>(
        listenWhen: (p, c) => !p.completed && c.completed,
        listener: (ctx, state) => ctx.router.replaceAll([const LoginRoute()]),
        builder: (ctx, state) {
          final cubit = ctx.read<OnboardingCubit>();
          return SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(16.w, 16.h, 16.w, 0),
                  child: Align(
                    alignment: AlignmentDirectional.centerEnd,
                    child: _LangToggle(
                      label: l.onboarding_lang_toggle,
                      onTap: () => MasrafyToast.info(ctx, l.common_coming_soon),
                    ),
                  ),
                ),
                Expanded(
                  child: PageView.builder(
                    controller: _controller,
                    onPageChanged: cubit.pageChanged,
                    itemCount: slides.length,
                    itemBuilder: (_, i) => OnboardingSlide(data: slides[i]),
                  ),
                ),
                _Stepper(count: state.totalPages, index: state.pageIndex),
                Gap(28.h),
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(24.w, 0, 24.w, 20.h),
                  child: state.isLastPage
                      ? _FinalActions(
                          onSignIn: cubit.finish,
                          onSocial: () =>
                              MasrafyToast.info(ctx, l.common_coming_soon),
                        )
                      : _PagerActions(
                          onNext: _next,
                          onSkip: cubit.finish,
                        ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Slides 1-2 action area: gradient Next + secondary Skip.
class _PagerActions extends StatelessWidget {
  const _PagerActions({required this.onNext, required this.onSkip});
  final VoidCallback onNext;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Column(
      children: [
        MasrafyGradientButton(label: l.onboarding_next, onPressed: onNext),
        Gap(14.h),
        MasrafySecondaryButton(
          label: l.onboarding_skip,
          onPressed: onSkip,
          width: double.infinity,
        ),
      ],
    );
  }
}

/// Final slide action area: gradient Sign in + social providers.
class _FinalActions extends StatelessWidget {
  const _FinalActions({required this.onSignIn, required this.onSocial});
  final VoidCallback onSignIn;
  final VoidCallback onSocial;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Column(
      children: [
        MasrafyGradientButton(label: l.onboarding_signin, onPressed: onSignIn),
        Gap(12.h),
        MasrafyOrDivider(label: l.onboarding_or_continue),
        Gap(14.h),
        Row(
          children: [
            Expanded(
              child: MasrafySocialButton(
                icon: Icons.g_mobiledata_rounded,
                label: l.onboarding_google,
                onTap: onSocial,
              ),
            ),
            Gap(15.w),
            Expanded(
              child: MasrafySocialButton(
                icon: Icons.apple,
                label: l.onboarding_apple,
                onTap: onSocial,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// Top-right language toggle pill (Figma header).
class _LangToggle extends StatelessWidget {
  const _LangToggle({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return InkWell(
      borderRadius: BorderRadius.circular(9999),
      onTap: onTap,
      child: Container(
        padding: EdgeInsetsDirectional.symmetric(horizontal: 17.w, vertical: 9.h),
        decoration: BoxDecoration(
          color: colors.primary.main,
          borderRadius: BorderRadius.circular(9999),
          border: Border.all(color: colors.white.withValues(alpha: 0.1)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.language, size: 15.r, color: colors.white),
            Gap(4.w),
            Text(
              label,
              style: text.bodySmall.copyWith(color: colors.white),
            ),
          ],
        ),
      ),
    );
  }
}

/// 3-bar progress stepper: active bar uses `primary.hover`, idle bars use
/// `secondary.border` (Figma `71:292`).
class _Stepper extends StatelessWidget {
  const _Stepper({required this.count, required this.index});
  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (i) {
        final active = i <= index;
        return Padding(
          padding: EdgeInsetsDirectional.only(end: i == count - 1 ? 0 : 4.w),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            width: 32.w,
            height: 4.h,
            decoration: BoxDecoration(
              color: active ? colors.primary.hover : colors.secondary.border,
              borderRadius: BorderRadius.circular(9999),
            ),
          ),
        );
      }),
    );
  }
}
