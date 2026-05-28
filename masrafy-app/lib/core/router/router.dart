import 'package:auto_route/auto_route.dart';

import 'router.gr.dart';

/// App router. Routes are flat at the top level; multi-step flows
/// (PhoneSignup, ForgotPassword, CompleteProfile) host their own step
/// widgets internally via cubit state.
@AutoRouterConfig(replaceInRouteName: 'Page|Screen,Route')
class AppRouter extends RootStackRouter {
  AppRouter();

  @override
  List<AutoRoute> get routes => [
        AutoRoute(page: LandingRoute.page, initial: true),
        AutoRoute(page: LoginRoute.page),
        AutoRoute(page: PhoneSignupRoute.page),
        AutoRoute(page: ForgotPasswordRoute.page),
        AutoRoute(page: CompleteProfileRoute.page),
      ];
}
