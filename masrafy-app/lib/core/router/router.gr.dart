// dart format width=80
// GENERATED CODE - DO NOT MODIFY BY HAND

// **************************************************************************
// AutoRouterGenerator
// **************************************************************************

// ignore_for_file: type=lint
// coverage:ignore-file

// ignore_for_file: no_leading_underscores_for_library_prefixes
import 'package:app/features/auth/domain/entities/otp_challenge_entity.dart'
    as _i13;
import 'package:app/features/auth/domain/entities/signup_draft.dart' as _i15;
import 'package:app/features/auth/domain/enums/otp_purpose.dart' as _i14;
import 'package:app/features/auth/presentation/pages/login/login.imports.dart'
    as _i4;
import 'package:app/features/auth/presentation/pages/otp/otp.imports.dart'
    as _i7;
import 'package:app/features/auth/presentation/pages/signup/signup.imports.dart'
    as _i9;
import 'package:app/features/home/presentation/pages/home/home.imports.dart'
    as _i3;
import 'package:app/features/onboarding/presentation/pages/onboarding/onboarding.imports.dart'
    as _i6;
import 'package:app/features/profile/presentation/models/profile_data.dart'
    as _i16;
import 'package:app/features/profile/presentation/pages/profile/profile.imports.dart'
    as _i8;
import 'package:app/features/questionnaire/presentation/pages/business/business.imports.dart'
    as _i1;
import 'package:app/features/questionnaire/presentation/pages/car/car.imports.dart'
    as _i2;
import 'package:app/features/questionnaire/presentation/pages/mortgage/mortgage.imports.dart'
    as _i5;
import 'package:app/features/splash/presentation/pages/splash/splash.imports.dart'
    as _i10;
import 'package:auto_route/auto_route.dart' as _i11;
import 'package:flutter/material.dart' as _i12;

/// generated route for
/// [_i1.BusinessQuestionnairePage]
class BusinessQuestionnaireRoute extends _i11.PageRouteInfo<void> {
  const BusinessQuestionnaireRoute({List<_i11.PageRouteInfo>? children})
    : super(BusinessQuestionnaireRoute.name, initialChildren: children);

  static const String name = 'BusinessQuestionnaireRoute';

  static _i11.PageInfo page = _i11.PageInfo(
    name,
    builder: (data) {
      return const _i1.BusinessQuestionnairePage();
    },
  );
}

/// generated route for
/// [_i2.CarQuestionnairePage]
class CarQuestionnaireRoute extends _i11.PageRouteInfo<void> {
  const CarQuestionnaireRoute({List<_i11.PageRouteInfo>? children})
    : super(CarQuestionnaireRoute.name, initialChildren: children);

  static const String name = 'CarQuestionnaireRoute';

  static _i11.PageInfo page = _i11.PageInfo(
    name,
    builder: (data) {
      return const _i2.CarQuestionnairePage();
    },
  );
}

/// generated route for
/// [_i3.HomePage]
class HomeRoute extends _i11.PageRouteInfo<void> {
  const HomeRoute({List<_i11.PageRouteInfo>? children})
    : super(HomeRoute.name, initialChildren: children);

  static const String name = 'HomeRoute';

  static _i11.PageInfo page = _i11.PageInfo(
    name,
    builder: (data) {
      return const _i3.HomePage();
    },
  );
}

/// generated route for
/// [_i4.LoginPage]
class LoginRoute extends _i11.PageRouteInfo<void> {
  const LoginRoute({List<_i11.PageRouteInfo>? children})
    : super(LoginRoute.name, initialChildren: children);

  static const String name = 'LoginRoute';

  static _i11.PageInfo page = _i11.PageInfo(
    name,
    builder: (data) {
      return const _i4.LoginPage();
    },
  );
}

/// generated route for
/// [_i5.MortgageQuestionnairePage]
class MortgageQuestionnaireRoute extends _i11.PageRouteInfo<void> {
  const MortgageQuestionnaireRoute({List<_i11.PageRouteInfo>? children})
    : super(MortgageQuestionnaireRoute.name, initialChildren: children);

  static const String name = 'MortgageQuestionnaireRoute';

  static _i11.PageInfo page = _i11.PageInfo(
    name,
    builder: (data) {
      return const _i5.MortgageQuestionnairePage();
    },
  );
}

/// generated route for
/// [_i6.OnboardingPage]
class OnboardingRoute extends _i11.PageRouteInfo<void> {
  const OnboardingRoute({List<_i11.PageRouteInfo>? children})
    : super(OnboardingRoute.name, initialChildren: children);

  static const String name = 'OnboardingRoute';

  static _i11.PageInfo page = _i11.PageInfo(
    name,
    builder: (data) {
      return const _i6.OnboardingPage();
    },
  );
}

/// generated route for
/// [_i7.OtpPage]
class OtpRoute extends _i11.PageRouteInfo<OtpRouteArgs> {
  OtpRoute({
    _i12.Key? key,
    required _i13.OtpChallengeEntity challenge,
    required _i14.OtpPurpose purpose,
    _i15.SignupDraft? draft,
    List<_i11.PageRouteInfo>? children,
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

  static _i11.PageInfo page = _i11.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<OtpRouteArgs>();
      return _i7.OtpPage(
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

  final _i12.Key? key;

  final _i13.OtpChallengeEntity challenge;

  final _i14.OtpPurpose purpose;

  final _i15.SignupDraft? draft;

  @override
  String toString() {
    return 'OtpRouteArgs{key: $key, challenge: $challenge, purpose: $purpose, draft: $draft}';
  }
}

/// generated route for
/// [_i8.ProfileEditContactPage]
class ProfileEditContactRoute
    extends _i11.PageRouteInfo<ProfileEditContactRouteArgs> {
  ProfileEditContactRoute({
    _i12.Key? key,
    required _i16.ProfileContactDraft initial,
    List<_i11.PageRouteInfo>? children,
  }) : super(
         ProfileEditContactRoute.name,
         args: ProfileEditContactRouteArgs(key: key, initial: initial),
         initialChildren: children,
       );

  static const String name = 'ProfileEditContactRoute';

  static _i11.PageInfo page = _i11.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<ProfileEditContactRouteArgs>();
      return _i8.ProfileEditContactPage(key: args.key, initial: args.initial);
    },
  );
}

class ProfileEditContactRouteArgs {
  const ProfileEditContactRouteArgs({this.key, required this.initial});

  final _i12.Key? key;

  final _i16.ProfileContactDraft initial;

  @override
  String toString() {
    return 'ProfileEditContactRouteArgs{key: $key, initial: $initial}';
  }
}

/// generated route for
/// [_i8.ProfileEditPersonalPage]
class ProfileEditPersonalRoute
    extends _i11.PageRouteInfo<ProfileEditPersonalRouteArgs> {
  ProfileEditPersonalRoute({
    _i12.Key? key,
    required _i16.ProfilePersonalDraft initial,
    List<_i11.PageRouteInfo>? children,
  }) : super(
         ProfileEditPersonalRoute.name,
         args: ProfileEditPersonalRouteArgs(key: key, initial: initial),
         initialChildren: children,
       );

  static const String name = 'ProfileEditPersonalRoute';

  static _i11.PageInfo page = _i11.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<ProfileEditPersonalRouteArgs>();
      return _i8.ProfileEditPersonalPage(key: args.key, initial: args.initial);
    },
  );
}

class ProfileEditPersonalRouteArgs {
  const ProfileEditPersonalRouteArgs({this.key, required this.initial});

  final _i12.Key? key;

  final _i16.ProfilePersonalDraft initial;

  @override
  String toString() {
    return 'ProfileEditPersonalRouteArgs{key: $key, initial: $initial}';
  }
}

/// generated route for
/// [_i8.ProfilePage]
class ProfileRoute extends _i11.PageRouteInfo<void> {
  const ProfileRoute({List<_i11.PageRouteInfo>? children})
    : super(ProfileRoute.name, initialChildren: children);

  static const String name = 'ProfileRoute';

  static _i11.PageInfo page = _i11.PageInfo(
    name,
    builder: (data) {
      return const _i8.ProfilePage();
    },
  );
}

/// generated route for
/// [_i9.SignupPage]
class SignupRoute extends _i11.PageRouteInfo<void> {
  const SignupRoute({List<_i11.PageRouteInfo>? children})
    : super(SignupRoute.name, initialChildren: children);

  static const String name = 'SignupRoute';

  static _i11.PageInfo page = _i11.PageInfo(
    name,
    builder: (data) {
      return const _i9.SignupPage();
    },
  );
}

/// generated route for
/// [_i10.SplashPage]
class SplashRoute extends _i11.PageRouteInfo<void> {
  const SplashRoute({List<_i11.PageRouteInfo>? children})
    : super(SplashRoute.name, initialChildren: children);

  static const String name = 'SplashRoute';

  static _i11.PageInfo page = _i11.PageInfo(
    name,
    builder: (data) {
      return const _i10.SplashPage();
    },
  );
}
