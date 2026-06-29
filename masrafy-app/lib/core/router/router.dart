import 'package:auto_route/auto_route.dart';

import 'router.gr.dart';

/// App router. [SplashRoute] is the initial gate: it resolves persisted state
/// and `replaceAll`s to Onboarding (first launch), Login (onboarded /
/// unauthenticated), Complete-Profile (authenticated but incomplete), or Home
/// (authenticated + complete). The gate's `replaceAll` targets use a fade
/// [CustomRoute] so Splash → next is a seamless cross-fade; forward pushes
/// (Signup / OTP) keep the default slide. Regenerate `router.gr.dart` via
/// build_runner after editing.
@AutoRouterConfig(replaceInRouteName: 'Page|Screen,Route')
class AppRouter extends RootStackRouter {
  AppRouter();

  static const _fadeMs = 400;

  @override
  List<AutoRoute> get routes => [
        CustomRoute(
          page: SplashRoute.page,
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
        AutoRoute(page: OtpRoute.page),
        CustomRoute(
          page: CompleteProfileRoute.page,
          transitionsBuilder: TransitionsBuilders.fadeIn,
          durationInMilliseconds: _fadeMs,
        ),
        CustomRoute(
          page: HomeRoute.page,
          initial: true,
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
        AutoRoute(page: AccountRoute.page),
        AutoRoute(page: SettingsSecurityRoute.page),
        AutoRoute(page: PreviousApplicationsRoute.page),
        AutoRoute(page: SavedOffersRoute.page),
      ];
}
