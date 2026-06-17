import 'package:auto_route/auto_route.dart';

import 'router.gr.dart';

/// App router. [SplashRoute] is the initial gate: it resolves persisted state
/// and `replaceAll`s to Onboarding (first launch), Login (onboarded /
/// unauthenticated), or Home (authenticated). Add new feature routes here and
/// regenerate `router.gr.dart` via build_runner.
@AutoRouterConfig(replaceInRouteName: 'Page|Screen,Route')
class AppRouter extends RootStackRouter {
  AppRouter();

  @override
  List<AutoRoute> get routes => [
        AutoRoute(page: SplashRoute.page),
        AutoRoute(page: OnboardingRoute.page),
        AutoRoute(page: LoginRoute.page),
        AutoRoute(page: SignupRoute.page),
        AutoRoute(page: OtpRoute.page),
        AutoRoute(page: HomeRoute.page, initial: true),
        AutoRoute(page: MortgageQuestionnaireRoute.page),
        AutoRoute(page: CarQuestionnaireRoute.page),
        AutoRoute(page: BusinessQuestionnaireRoute.page),
        AutoRoute(page: MatchResultsRoute.page),
        AutoRoute(page: OfferDetailsRoute.page),
        AutoRoute(page: ProfileRoute.page),
        AutoRoute(page: ProfileEditPersonalRoute.page),
        AutoRoute(page: ProfileEditContactRoute.page),
        AutoRoute(page: AccountRoute.page),
      ];
}
