part of 'phone_signup.imports.dart';

/// Phone-signup flow root. Provides [PhoneSignupCubit] and renders the
/// current step's page based on `state.step`. Step pages live as
/// `part of` widgets and read the cubit from inherited context.
@RoutePage()
class PhoneSignupPage extends StatelessWidget {
  const PhoneSignupPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PhoneSignupCubit>(
      create: (_) => getIt<PhoneSignupCubit>(),
      child: const _PhoneSignupView(),
    );
  }
}

class _PhoneSignupView extends StatelessWidget {
  const _PhoneSignupView();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<PhoneSignupCubit, PhoneSignupState>(
      buildWhen: (a, b) => a.step != b.step,
      builder: (context, state) {
        switch (state.step) {
          case PhoneSignupStep.idle:
          case PhoneSignupStep.requestingOtp:
            return const PhoneSignupMobilePage();
          case PhoneSignupStep.otpSent:
          case PhoneSignupStep.verifyingOtp:
            return const PhoneSignupOtpPage();
          case PhoneSignupStep.mobileVerified:
          case PhoneSignupStep.submittingProfile:
            return const PhoneSignupProfilePage();
          case PhoneSignupStep.success:
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
