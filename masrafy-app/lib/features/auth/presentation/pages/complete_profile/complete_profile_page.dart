part of 'complete_profile.imports.dart';

/// Complete-profile flow root. Provides [CompleteProfileCubit] and renders
/// the current step's page based on `state.step`. Pops once mobile is
/// bound — email + age collection happens outside this flow.
@RoutePage()
class CompleteProfilePage extends StatelessWidget {
  const CompleteProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<CompleteProfileCubit>(
      create: (_) => getIt<CompleteProfileCubit>(),
      child: const _CompleteProfileView(),
    );
  }
}

class _CompleteProfileView extends StatelessWidget {
  const _CompleteProfileView();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CompleteProfileCubit, CompleteProfileState>(
      buildWhen: (a, b) => a.step != b.step,
      builder: (context, state) {
        switch (state.step) {
          case CompleteProfileStep.idle:
          case CompleteProfileStep.requestingOtp:
            return const CompleteProfileMobilePage();
          case CompleteProfileStep.otpSent:
          case CompleteProfileStep.verifyingOtp:
            return const CompleteProfileOtpPage();
          case CompleteProfileStep.mobileBound:
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (context.mounted) context.router.maybePop();
            });
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
        }
      },
    );
  }
}
