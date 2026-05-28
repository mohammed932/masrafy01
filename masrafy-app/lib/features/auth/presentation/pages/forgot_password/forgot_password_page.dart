part of 'forgot_password.imports.dart';

/// Forgot-password flow root. Provides [ForgotPasswordCubit] and renders
/// the current step's page based on `state.step`.
@RoutePage()
class ForgotPasswordPage extends StatelessWidget {
  const ForgotPasswordPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<ForgotPasswordCubit>(
      create: (_) => getIt<ForgotPasswordCubit>(),
      child: const _ForgotPasswordView(),
    );
  }
}

class _ForgotPasswordView extends StatelessWidget {
  const _ForgotPasswordView();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ForgotPasswordCubit, ForgotPasswordState>(
      buildWhen: (a, b) => a.step != b.step,
      builder: (context, state) {
        switch (state.step) {
          case ForgotPasswordStep.idle:
          case ForgotPasswordStep.requestingOtp:
            return const ForgotPasswordMobilePage();
          case ForgotPasswordStep.otpSent:
          case ForgotPasswordStep.verifying:
            return const ForgotPasswordOtpPage();
          case ForgotPasswordStep.tokenIssued:
          case ForgotPasswordStep.resetting:
            return const ForgotPasswordResetPage();
          case ForgotPasswordStep.success:
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
