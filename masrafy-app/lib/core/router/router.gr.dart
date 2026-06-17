// dart format width=80
// GENERATED CODE - DO NOT MODIFY BY HAND

// **************************************************************************
// AutoRouterGenerator
// **************************************************************************

// ignore_for_file: type=lint
// coverage:ignore-file

// ignore_for_file: no_leading_underscores_for_library_prefixes
import 'package:app/features/account/presentation/pages/account/account.imports.dart'
    as _i1;
import 'package:app/features/auth/domain/entities/otp_challenge_entity.dart'
    as _i17;
import 'package:app/features/auth/domain/entities/signup_draft.dart' as _i19;
import 'package:app/features/auth/domain/enums/otp_purpose.dart' as _i18;
import 'package:app/features/auth/presentation/pages/login/login.imports.dart'
    as _i5;
import 'package:app/features/auth/presentation/pages/otp/otp.imports.dart'
    as _i10;
import 'package:app/features/auth/presentation/pages/signup/signup.imports.dart'
    as _i12;
import 'package:app/features/home/presentation/pages/home/home.imports.dart'
    as _i4;
import 'package:app/features/offers/presentation/models/match_results_args.dart'
    as _i16;
import 'package:app/features/offers/presentation/pages/offer_details/offer_details.imports.dart'
    as _i8;
import 'package:app/features/offers/presentation/pages/results/results.imports.dart'
    as _i6;
import 'package:app/features/onboarding/presentation/pages/onboarding/onboarding.imports.dart'
    as _i9;
import 'package:app/features/profile/presentation/models/profile_data.dart'
    as _i20;
import 'package:app/features/profile/presentation/pages/profile/profile.imports.dart'
    as _i11;
import 'package:app/features/questionnaire/presentation/pages/business/business.imports.dart'
    as _i2;
import 'package:app/features/questionnaire/presentation/pages/car/car.imports.dart'
    as _i3;
import 'package:app/features/questionnaire/presentation/pages/mortgage/mortgage.imports.dart'
    as _i7;
import 'package:app/features/splash/presentation/pages/splash/splash.imports.dart'
    as _i13;
import 'package:auto_route/auto_route.dart' as _i14;
import 'package:flutter/material.dart' as _i15;

/// generated route for
/// [_i1.AccountPage]
class AccountRoute extends _i14.PageRouteInfo<void> {
  const AccountRoute({List<_i14.PageRouteInfo>? children})
    : super(AccountRoute.name, initialChildren: children);

  static const String name = 'AccountRoute';

  static _i14.PageInfo page = _i14.PageInfo(
    name,
    builder: (data) {
      return const _i1.AccountPage();
    },
  );
}

/// generated route for
/// [_i2.BusinessQuestionnairePage]
class BusinessQuestionnaireRoute extends _i14.PageRouteInfo<void> {
  const BusinessQuestionnaireRoute({List<_i14.PageRouteInfo>? children})
    : super(BusinessQuestionnaireRoute.name, initialChildren: children);

  static const String name = 'BusinessQuestionnaireRoute';

  static _i14.PageInfo page = _i14.PageInfo(
    name,
    builder: (data) {
      return const _i2.BusinessQuestionnairePage();
    },
  );
}

/// generated route for
/// [_i3.CarQuestionnairePage]
class CarQuestionnaireRoute extends _i14.PageRouteInfo<void> {
  const CarQuestionnaireRoute({List<_i14.PageRouteInfo>? children})
    : super(CarQuestionnaireRoute.name, initialChildren: children);

  static const String name = 'CarQuestionnaireRoute';

  static _i14.PageInfo page = _i14.PageInfo(
    name,
    builder: (data) {
      return const _i3.CarQuestionnairePage();
    },
  );
}

/// generated route for
/// [_i4.HomePage]
class HomeRoute extends _i14.PageRouteInfo<void> {
  const HomeRoute({List<_i14.PageRouteInfo>? children})
    : super(HomeRoute.name, initialChildren: children);

  static const String name = 'HomeRoute';

  static _i14.PageInfo page = _i14.PageInfo(
    name,
    builder: (data) {
      return const _i4.HomePage();
    },
  );
}

/// generated route for
/// [_i5.LoginPage]
class LoginRoute extends _i14.PageRouteInfo<void> {
  const LoginRoute({List<_i14.PageRouteInfo>? children})
    : super(LoginRoute.name, initialChildren: children);

  static const String name = 'LoginRoute';

  static _i14.PageInfo page = _i14.PageInfo(
    name,
    builder: (data) {
      return const _i5.LoginPage();
    },
  );
}

/// generated route for
/// [_i6.MatchResultsPage]
class MatchResultsRoute extends _i14.PageRouteInfo<MatchResultsRouteArgs> {
  MatchResultsRoute({
    _i15.Key? key,
    required _i16.MatchResultsArgs args,
    List<_i14.PageRouteInfo>? children,
  }) : super(
         MatchResultsRoute.name,
         args: MatchResultsRouteArgs(key: key, args: args),
         initialChildren: children,
       );

  static const String name = 'MatchResultsRoute';

  static _i14.PageInfo page = _i14.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<MatchResultsRouteArgs>();
      return _i6.MatchResultsPage(key: args.key, args: args.args);
    },
  );
}

class MatchResultsRouteArgs {
  const MatchResultsRouteArgs({this.key, required this.args});

  final _i15.Key? key;

  final _i16.MatchResultsArgs args;

  @override
  String toString() {
    return 'MatchResultsRouteArgs{key: $key, args: $args}';
  }
}

/// generated route for
/// [_i7.MortgageQuestionnairePage]
class MortgageQuestionnaireRoute extends _i14.PageRouteInfo<void> {
  const MortgageQuestionnaireRoute({List<_i14.PageRouteInfo>? children})
    : super(MortgageQuestionnaireRoute.name, initialChildren: children);

  static const String name = 'MortgageQuestionnaireRoute';

  static _i14.PageInfo page = _i14.PageInfo(
    name,
    builder: (data) {
      return const _i7.MortgageQuestionnairePage();
    },
  );
}

/// generated route for
/// [_i8.OfferDetailsPage]
class OfferDetailsRoute extends _i14.PageRouteInfo<OfferDetailsRouteArgs> {
  OfferDetailsRoute({
    _i15.Key? key,
    required _i16.MatchOffer offer,
    required _i16.MatchResultsArgs summary,
    List<_i14.PageRouteInfo>? children,
  }) : super(
         OfferDetailsRoute.name,
         args: OfferDetailsRouteArgs(key: key, offer: offer, summary: summary),
         initialChildren: children,
       );

  static const String name = 'OfferDetailsRoute';

  static _i14.PageInfo page = _i14.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<OfferDetailsRouteArgs>();
      return _i8.OfferDetailsPage(
        key: args.key,
        offer: args.offer,
        summary: args.summary,
      );
    },
  );
}

class OfferDetailsRouteArgs {
  const OfferDetailsRouteArgs({
    this.key,
    required this.offer,
    required this.summary,
  });

  final _i15.Key? key;

  final _i16.MatchOffer offer;

  final _i16.MatchResultsArgs summary;

  @override
  String toString() {
    return 'OfferDetailsRouteArgs{key: $key, offer: $offer, summary: $summary}';
  }
}

/// generated route for
/// [_i9.OnboardingPage]
class OnboardingRoute extends _i14.PageRouteInfo<void> {
  const OnboardingRoute({List<_i14.PageRouteInfo>? children})
    : super(OnboardingRoute.name, initialChildren: children);

  static const String name = 'OnboardingRoute';

  static _i14.PageInfo page = _i14.PageInfo(
    name,
    builder: (data) {
      return const _i9.OnboardingPage();
    },
  );
}

/// generated route for
/// [_i10.OtpPage]
class OtpRoute extends _i14.PageRouteInfo<OtpRouteArgs> {
  OtpRoute({
    _i15.Key? key,
    required _i17.OtpChallengeEntity challenge,
    required _i18.OtpPurpose purpose,
    _i19.SignupDraft? draft,
    List<_i14.PageRouteInfo>? children,
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

  static _i14.PageInfo page = _i14.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<OtpRouteArgs>();
      return _i10.OtpPage(
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

  final _i15.Key? key;

  final _i17.OtpChallengeEntity challenge;

  final _i18.OtpPurpose purpose;

  final _i19.SignupDraft? draft;

  @override
  String toString() {
    return 'OtpRouteArgs{key: $key, challenge: $challenge, purpose: $purpose, draft: $draft}';
  }
}

/// generated route for
/// [_i11.ProfileEditContactPage]
class ProfileEditContactRoute
    extends _i14.PageRouteInfo<ProfileEditContactRouteArgs> {
  ProfileEditContactRoute({
    _i15.Key? key,
    required _i20.ProfileContactDraft initial,
    List<_i14.PageRouteInfo>? children,
  }) : super(
         ProfileEditContactRoute.name,
         args: ProfileEditContactRouteArgs(key: key, initial: initial),
         initialChildren: children,
       );

  static const String name = 'ProfileEditContactRoute';

  static _i14.PageInfo page = _i14.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<ProfileEditContactRouteArgs>();
      return _i11.ProfileEditContactPage(key: args.key, initial: args.initial);
    },
  );
}

class ProfileEditContactRouteArgs {
  const ProfileEditContactRouteArgs({this.key, required this.initial});

  final _i15.Key? key;

  final _i20.ProfileContactDraft initial;

  @override
  String toString() {
    return 'ProfileEditContactRouteArgs{key: $key, initial: $initial}';
  }
}

/// generated route for
/// [_i11.ProfileEditPersonalPage]
class ProfileEditPersonalRoute
    extends _i14.PageRouteInfo<ProfileEditPersonalRouteArgs> {
  ProfileEditPersonalRoute({
    _i15.Key? key,
    required _i20.ProfilePersonalDraft initial,
    List<_i14.PageRouteInfo>? children,
  }) : super(
         ProfileEditPersonalRoute.name,
         args: ProfileEditPersonalRouteArgs(key: key, initial: initial),
         initialChildren: children,
       );

  static const String name = 'ProfileEditPersonalRoute';

  static _i14.PageInfo page = _i14.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<ProfileEditPersonalRouteArgs>();
      return _i11.ProfileEditPersonalPage(key: args.key, initial: args.initial);
    },
  );
}

class ProfileEditPersonalRouteArgs {
  const ProfileEditPersonalRouteArgs({this.key, required this.initial});

  final _i15.Key? key;

  final _i20.ProfilePersonalDraft initial;

  @override
  String toString() {
    return 'ProfileEditPersonalRouteArgs{key: $key, initial: $initial}';
  }
}

/// generated route for
/// [_i11.ProfilePage]
class ProfileRoute extends _i14.PageRouteInfo<void> {
  const ProfileRoute({List<_i14.PageRouteInfo>? children})
    : super(ProfileRoute.name, initialChildren: children);

  static const String name = 'ProfileRoute';

  static _i14.PageInfo page = _i14.PageInfo(
    name,
    builder: (data) {
      return const _i11.ProfilePage();
    },
  );
}

/// generated route for
/// [_i12.SignupPage]
class SignupRoute extends _i14.PageRouteInfo<void> {
  const SignupRoute({List<_i14.PageRouteInfo>? children})
    : super(SignupRoute.name, initialChildren: children);

  static const String name = 'SignupRoute';

  static _i14.PageInfo page = _i14.PageInfo(
    name,
    builder: (data) {
      return const _i12.SignupPage();
    },
  );
}

/// generated route for
/// [_i13.SplashPage]
class SplashRoute extends _i14.PageRouteInfo<void> {
  const SplashRoute({List<_i14.PageRouteInfo>? children})
    : super(SplashRoute.name, initialChildren: children);

  static const String name = 'SplashRoute';

  static _i14.PageInfo page = _i14.PageInfo(
    name,
    builder: (data) {
      return const _i13.SplashPage();
    },
  );
}
