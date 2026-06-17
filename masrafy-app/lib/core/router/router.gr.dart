// dart format width=80
// GENERATED CODE - DO NOT MODIFY BY HAND

// **************************************************************************
// AutoRouterGenerator
// **************************************************************************

// ignore_for_file: type=lint
// coverage:ignore-file

// ignore_for_file: no_leading_underscores_for_library_prefixes
import 'package:app/features/auth/domain/entities/otp_challenge_entity.dart'
    as _i10;
import 'package:app/features/auth/domain/entities/signup_draft.dart' as _i12;
import 'package:app/features/auth/domain/enums/otp_purpose.dart' as _i11;
import 'package:app/features/auth/presentation/pages/login/login.imports.dart'
    as _i2;
import 'package:app/features/auth/presentation/pages/otp/otp.imports.dart'
    as _i5;
import 'package:app/features/auth/presentation/pages/signup/signup.imports.dart'
    as _i6;
import 'package:app/features/home/presentation/pages/home/home.imports.dart'
    as _i1;
import 'package:app/features/onboarding/presentation/pages/onboarding/onboarding.imports.dart'
    as _i4;
import 'package:app/features/questionnaire/presentation/pages/mortgage/mortgage.imports.dart'
    as _i3;
import 'package:app/features/splash/presentation/pages/splash/splash.imports.dart'
    as _i7;
import 'package:auto_route/auto_route.dart' as _i8;
import 'package:flutter/material.dart' as _i9;

/// generated route for
/// [_i1.HomePage]
class HomeRoute extends _i8.PageRouteInfo<void> {
  const HomeRoute({List<_i8.PageRouteInfo>? children})
    : super(HomeRoute.name, initialChildren: children);

  static const String name = 'HomeRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      return const _i1.HomePage();
    },
  );
}

/// generated route for
/// [_i2.LoginPage]
class LoginRoute extends _i8.PageRouteInfo<void> {
  const LoginRoute({List<_i8.PageRouteInfo>? children})
    : super(LoginRoute.name, initialChildren: children);

  static const String name = 'LoginRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      return const _i2.LoginPage();
    },
  );
}

/// generated route for
/// [_i3.MortgageQuestionnairePage]
class MortgageQuestionnaireRoute extends _i8.PageRouteInfo<void> {
  const MortgageQuestionnaireRoute({List<_i8.PageRouteInfo>? children})
    : super(MortgageQuestionnaireRoute.name, initialChildren: children);

  static const String name = 'MortgageQuestionnaireRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      return const _i3.MortgageQuestionnairePage();
    },
  );
}

/// generated route for
/// [_i4.OnboardingPage]
class OnboardingRoute extends _i8.PageRouteInfo<void> {
  const OnboardingRoute({List<_i8.PageRouteInfo>? children})
    : super(OnboardingRoute.name, initialChildren: children);

  static const String name = 'OnboardingRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      return const _i4.OnboardingPage();
    },
  );
}

/// generated route for
/// [_i5.OtpPage]
class OtpRoute extends _i8.PageRouteInfo<OtpRouteArgs> {
  OtpRoute({
    _i9.Key? key,
    required _i10.OtpChallengeEntity challenge,
    required _i11.OtpPurpose purpose,
    _i12.SignupDraft? draft,
    List<_i8.PageRouteInfo>? children,
  }) : super(
         OtpRoute.name,
         args: OtpRouteArgs(
           key: key,
           challenge: challenge,
           purpose: purpose,
           draft: draft,
         ),
         initialChildren: children,
       );

  static const String name = 'OtpRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<OtpRouteArgs>();
      return _i5.OtpPage(
        key: args.key,
        challenge: args.challenge,
        purpose: args.purpose,
        draft: args.draft,
      );
    },
  );
}

class OtpRouteArgs {
  const OtpRouteArgs({
    this.key,
    required this.challenge,
    required this.purpose,
    this.draft,
  });

  final _i9.Key? key;

  final _i10.OtpChallengeEntity challenge;

  final _i11.OtpPurpose purpose;

  final _i12.SignupDraft? draft;

  @override
  String toString() {
    return 'OtpRouteArgs{key: $key, challenge: $challenge, purpose: $purpose, draft: $draft}';
  }
}

/// generated route for
/// [_i6.SignupPage]
class SignupRoute extends _i8.PageRouteInfo<void> {
  const SignupRoute({List<_i8.PageRouteInfo>? children})
    : super(SignupRoute.name, initialChildren: children);

  static const String name = 'SignupRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      return const _i6.SignupPage();
    },
  );
}

/// generated route for
/// [_i7.SplashPage]
class SplashRoute extends _i8.PageRouteInfo<void> {
  const SplashRoute({List<_i8.PageRouteInfo>? children})
    : super(SplashRoute.name, initialChildren: children);

  static const String name = 'SplashRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      return const _i7.SplashPage();
    },
  );
}
