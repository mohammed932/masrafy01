import 'package:auto_route/auto_route.dart';

import 'router.gr.dart';

/// App router. [SplashRoute] is the initial gate: it resolves persisted state
/// and `replaceAll`s to Onboarding (first launch), Login (onboarded /
/// unauthenticated), Complete-Profile (authenticated but incomplete), or
/// [MainShellRoute] (authenticated + complete). The gate's `replaceAll` targets
/// use a fade [CustomRoute] so Splash → next is a seamless cross-fade; forward
/// pushes (Signup / OTP) keep the default slide.
///
/// [MainShellRoute] is the signed-in root and the ONLY route for the three
/// tabs — Home and Account have no routes of their own, they are bodies inside
/// the shell, so switching tabs is never a navigation. Screens opened from a
/// tab push on top of the shell and come back via `openMainTab`. Regenerate
/// `router.gr.dart` via build_runner after editing.
@AutoRouterConfig(replaceInRouteName: 'Page|Screen,Route')
class AppRouter extends RootStackRouter {
  AppRouter();

  static const _fadeMs = 400;

  @override
  List<AutoRoute> get routes => [
        CustomRoute(
          page: SplashRoute.page,
          initial: true,
          transitionsBuilder: TransitionsBuilders.fadeIn,
          durationInMilliseconds: _fadeMs,
        ),
        CustomRoute(
          page: OnboardingRoute.page,
          transitionsBuilder: TransitionsBuilders.fadeIn,
          durationInMilliseconds: _fadeMs,
        ),
        CustomRoute(
          page: LoginRoute.page,
          transitionsBuilder: TransitionsBuilders.fadeIn,
          durationInMilliseconds: _fadeMs,
        ),
        AutoRoute(page: SignupRoute.page),
        AutoRoute(page: ForgotPasswordRoute.page),
        AutoRoute(page: PhoneVerificationRoute.page),
        AutoRoute(page: OtpRoute.page),
        CustomRoute(
          page: CompleteProfileRoute.page,
          transitionsBuilder: TransitionsBuilders.fadeIn,
          durationInMilliseconds: _fadeMs,
        ),
        AutoRoute(page: ApplyDocumentsRoute.page),
        CustomRoute(
          page: MainShellRoute.page,
          transitionsBuilder: TransitionsBuilders.fadeIn,
          durationInMilliseconds: _fadeMs,
        ),
        AutoRoute(page: MortgageQuestionnaireRoute.page),
        AutoRoute(page: CarQuestionnaireRoute.page),
        AutoRoute(page: BusinessQuestionnaireRoute.page),
        AutoRoute(page: PersonalQuestionnaireRoute.page),
        AutoRoute(page: MatchResultsRoute.page),
        AutoRoute(page: OfferDetailsRoute.page),
        AutoRoute(page: ProfileRoute.page),
        AutoRoute(page: ProfileEditPersonalRoute.page),
        AutoRoute(page: ProfileEditContactRoute.page),
        AutoRoute(page: SettingsSecurityRoute.page),
        AutoRoute(page: ChangePasswordRoute.page),
        AutoRoute(page: PreviousApplicationsRoute.page),
        AutoRoute(page: SavedOffersRoute.page),
        AutoRoute(page: BiometricLockRoute.page),
        AutoRoute(page: IdCaptureRoute.page),
      ];
}
