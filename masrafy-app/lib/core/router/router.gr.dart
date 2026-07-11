// dart format width=80
// GENERATED CODE - DO NOT MODIFY BY HAND

// **************************************************************************
// AutoRouterGenerator
// **************************************************************************

// ignore_for_file: type=lint
// coverage:ignore-file

// ignore_for_file: no_leading_underscores_for_library_prefixes
import 'package:app/core/features/biometric/presentation/biometric_lock_page.dart'
    as _i3;
import 'package:app/features/account/presentation/pages/account/account.imports.dart'
    as _i1;
import 'package:app/features/account/presentation/pages/settings_security/settings_security.imports.dart'
    as _i18;
import 'package:app/features/applications/presentation/pages/previous_applications/previous_applications.imports.dart'
    as _i15;
import 'package:app/features/auth/domain/entities/otp_challenge_entity.dart'
    as _i25;
import 'package:app/features/auth/domain/entities/signup_draft.dart' as _i23;
import 'package:app/features/auth/domain/enums/otp_purpose.dart' as _i26;
import 'package:app/features/auth/presentation/pages/apply_documents/apply_documents.imports.dart'
    as _i2;
import 'package:app/features/auth/presentation/pages/complete_profile/complete_profile.imports.dart'
    as _i6;
import 'package:app/features/auth/presentation/pages/login/login.imports.dart'
    as _i8;
import 'package:app/features/auth/presentation/pages/otp/otp.imports.dart'
    as _i13;
import 'package:app/features/auth/presentation/pages/signup/signup.imports.dart'
    as _i19;
import 'package:app/features/home/presentation/pages/home/home.imports.dart'
    as _i7;
import 'package:app/features/offers/presentation/models/match_results_args.dart'
    as _i24;
import 'package:app/features/offers/presentation/pages/offer_details/offer_details.imports.dart'
    as _i11;
import 'package:app/features/offers/presentation/pages/results/results.imports.dart'
    as _i9;
import 'package:app/features/onboarding/presentation/pages/onboarding/onboarding.imports.dart'
    as _i12;
import 'package:app/features/profile/presentation/models/profile_data.dart'
    as _i27;
import 'package:app/features/profile/presentation/pages/profile/profile.imports.dart'
    as _i16;
import 'package:app/features/questionnaire/presentation/pages/business/business_questionnaire_page.dart'
    as _i4;
import 'package:app/features/questionnaire/presentation/pages/car/car_questionnaire_page.dart'
    as _i5;
import 'package:app/features/questionnaire/presentation/pages/mortgage/mortgage_questionnaire_page.dart'
    as _i10;
import 'package:app/features/questionnaire/presentation/pages/personal/personal_questionnaire_page.dart'
    as _i14;
import 'package:app/features/saved_offers/presentation/pages/saved_offers/saved_offers.imports.dart'
    as _i17;
import 'package:app/features/splash/presentation/pages/splash/splash.imports.dart'
    as _i20;
import 'package:auto_route/auto_route.dart' as _i21;
import 'package:flutter/material.dart' as _i22;

/// generated route for
/// [_i1.AccountPage]
class AccountRoute extends _i21.PageRouteInfo<void> {
  const AccountRoute({List<_i21.PageRouteInfo>? children})
    : super(AccountRoute.name, initialChildren: children);

  static const String name = 'AccountRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      return const _i1.AccountPage();
    },
  );
}

/// generated route for
/// [_i2.ApplyDocumentsPage]
class ApplyDocumentsRoute extends _i21.PageRouteInfo<void> {
  const ApplyDocumentsRoute({List<_i21.PageRouteInfo>? children})
    : super(ApplyDocumentsRoute.name, initialChildren: children);

  static const String name = 'ApplyDocumentsRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      return const _i2.ApplyDocumentsPage();
    },
  );
}

/// generated route for
/// [_i3.BiometricLockPage]
class BiometricLockRoute extends _i21.PageRouteInfo<void> {
  const BiometricLockRoute({List<_i21.PageRouteInfo>? children})
    : super(BiometricLockRoute.name, initialChildren: children);

  static const String name = 'BiometricLockRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      return const _i3.BiometricLockPage();
    },
  );
}

/// generated route for
/// [_i4.BusinessQuestionnairePage]
class BusinessQuestionnaireRoute extends _i21.PageRouteInfo<void> {
  const BusinessQuestionnaireRoute({List<_i21.PageRouteInfo>? children})
    : super(BusinessQuestionnaireRoute.name, initialChildren: children);

  static const String name = 'BusinessQuestionnaireRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      return const _i4.BusinessQuestionnairePage();
    },
  );
}

/// generated route for
/// [_i5.CarQuestionnairePage]
class CarQuestionnaireRoute extends _i21.PageRouteInfo<void> {
  const CarQuestionnaireRoute({List<_i21.PageRouteInfo>? children})
    : super(CarQuestionnaireRoute.name, initialChildren: children);

  static const String name = 'CarQuestionnaireRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      return const _i5.CarQuestionnairePage();
    },
  );
}

/// generated route for
/// [_i6.CompleteProfilePage]
class CompleteProfileRoute
    extends _i21.PageRouteInfo<CompleteProfileRouteArgs> {
  CompleteProfileRoute({
    _i22.Key? key,
    _i23.SignupDraft? draft,
    List<_i21.PageRouteInfo>? children,
  }) : super(
         CompleteProfileRoute.name,
         args: CompleteProfileRouteArgs(key: key, draft: draft),
         initialChildren: children,
       );

  static const String name = 'CompleteProfileRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<CompleteProfileRouteArgs>(
        orElse: () => const CompleteProfileRouteArgs(),
      );
      return _i6.CompleteProfilePage(key: args.key, draft: args.draft);
    },
  );
}

class CompleteProfileRouteArgs {
  const CompleteProfileRouteArgs({this.key, this.draft});

  final _i22.Key? key;

  final _i23.SignupDraft? draft;

  @override
  String toString() {
    return 'CompleteProfileRouteArgs{key: $key, draft: $draft}';
  }
}

/// generated route for
/// [_i7.HomePage]
class HomeRoute extends _i21.PageRouteInfo<void> {
  const HomeRoute({List<_i21.PageRouteInfo>? children})
    : super(HomeRoute.name, initialChildren: children);

  static const String name = 'HomeRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      return const _i7.HomePage();
    },
  );
}

/// generated route for
/// [_i8.LoginPage]
class LoginRoute extends _i21.PageRouteInfo<void> {
  const LoginRoute({List<_i21.PageRouteInfo>? children})
    : super(LoginRoute.name, initialChildren: children);

  static const String name = 'LoginRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      return const _i8.LoginPage();
    },
  );
}

/// generated route for
/// [_i9.MatchResultsPage]
class MatchResultsRoute extends _i21.PageRouteInfo<MatchResultsRouteArgs> {
  MatchResultsRoute({
    _i22.Key? key,
    required _i24.MatchResultsArgs args,
    List<_i21.PageRouteInfo>? children,
  }) : super(
         MatchResultsRoute.name,
         args: MatchResultsRouteArgs(key: key, args: args),
         initialChildren: children,
       );

  static const String name = 'MatchResultsRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<MatchResultsRouteArgs>();
      return _i9.MatchResultsPage(key: args.key, args: args.args);
    },
  );
}

class MatchResultsRouteArgs {
  const MatchResultsRouteArgs({this.key, required this.args});

  final _i22.Key? key;

  final _i24.MatchResultsArgs args;

  @override
  String toString() {
    return 'MatchResultsRouteArgs{key: $key, args: $args}';
  }
}

/// generated route for
/// [_i10.MortgageQuestionnairePage]
class MortgageQuestionnaireRoute extends _i21.PageRouteInfo<void> {
  const MortgageQuestionnaireRoute({List<_i21.PageRouteInfo>? children})
    : super(MortgageQuestionnaireRoute.name, initialChildren: children);

  static const String name = 'MortgageQuestionnaireRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      return const _i10.MortgageQuestionnairePage();
    },
  );
}

/// generated route for
/// [_i11.OfferDetailsPage]
class OfferDetailsRoute extends _i21.PageRouteInfo<OfferDetailsRouteArgs> {
  OfferDetailsRoute({
    _i22.Key? key,
    required _i24.MatchOffer offer,
    required _i24.MatchResultsArgs summary,
    List<_i21.PageRouteInfo>? children,
  }) : super(
         OfferDetailsRoute.name,
         args: OfferDetailsRouteArgs(key: key, offer: offer, summary: summary),
         initialChildren: children,
       );

  static const String name = 'OfferDetailsRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<OfferDetailsRouteArgs>();
      return _i11.OfferDetailsPage(
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

  final _i22.Key? key;

  final _i24.MatchOffer offer;

  final _i24.MatchResultsArgs summary;

  @override
  String toString() {
    return 'OfferDetailsRouteArgs{key: $key, offer: $offer, summary: $summary}';
  }
}

/// generated route for
/// [_i12.OnboardingPage]
class OnboardingRoute extends _i21.PageRouteInfo<void> {
  const OnboardingRoute({List<_i21.PageRouteInfo>? children})
    : super(OnboardingRoute.name, initialChildren: children);

  static const String name = 'OnboardingRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      return const _i12.OnboardingPage();
    },
  );
}

/// generated route for
/// [_i13.OtpPage]
class OtpRoute extends _i21.PageRouteInfo<OtpRouteArgs> {
  OtpRoute({
    _i22.Key? key,
    required _i25.OtpChallengeEntity challenge,
    required _i26.OtpPurpose purpose,
    _i23.SignupDraft? draft,
    List<_i21.PageRouteInfo>? children,
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

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<OtpRouteArgs>();
      return _i13.OtpPage(
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

  final _i22.Key? key;

  final _i25.OtpChallengeEntity challenge;

  final _i26.OtpPurpose purpose;

  final _i23.SignupDraft? draft;

  @override
  String toString() {
    return 'OtpRouteArgs{key: $key, challenge: $challenge, purpose: $purpose, draft: $draft}';
  }
}

/// generated route for
/// [_i14.PersonalQuestionnairePage]
class PersonalQuestionnaireRoute extends _i21.PageRouteInfo<void> {
  const PersonalQuestionnaireRoute({List<_i21.PageRouteInfo>? children})
    : super(PersonalQuestionnaireRoute.name, initialChildren: children);

  static const String name = 'PersonalQuestionnaireRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      return const _i14.PersonalQuestionnairePage();
    },
  );
}

/// generated route for
/// [_i15.PreviousApplicationsPage]
class PreviousApplicationsRoute extends _i21.PageRouteInfo<void> {
  const PreviousApplicationsRoute({List<_i21.PageRouteInfo>? children})
    : super(PreviousApplicationsRoute.name, initialChildren: children);

  static const String name = 'PreviousApplicationsRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      return const _i15.PreviousApplicationsPage();
    },
  );
}

/// generated route for
/// [_i16.ProfileEditContactPage]
class ProfileEditContactRoute
    extends _i21.PageRouteInfo<ProfileEditContactRouteArgs> {
  ProfileEditContactRoute({
    _i22.Key? key,
    required _i27.ProfileContactDraft initial,
    List<_i21.PageRouteInfo>? children,
  }) : super(
         ProfileEditContactRoute.name,
         args: ProfileEditContactRouteArgs(key: key, initial: initial),
         initialChildren: children,
       );

  static const String name = 'ProfileEditContactRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<ProfileEditContactRouteArgs>();
      return _i16.ProfileEditContactPage(key: args.key, initial: args.initial);
    },
  );
}

class ProfileEditContactRouteArgs {
  const ProfileEditContactRouteArgs({this.key, required this.initial});

  final _i22.Key? key;

  final _i27.ProfileContactDraft initial;

  @override
  String toString() {
    return 'ProfileEditContactRouteArgs{key: $key, initial: $initial}';
  }
}

/// generated route for
/// [_i16.ProfileEditPersonalPage]
class ProfileEditPersonalRoute
    extends _i21.PageRouteInfo<ProfileEditPersonalRouteArgs> {
  ProfileEditPersonalRoute({
    _i22.Key? key,
    required _i27.ProfilePersonalDraft initial,
    List<_i21.PageRouteInfo>? children,
  }) : super(
         ProfileEditPersonalRoute.name,
         args: ProfileEditPersonalRouteArgs(key: key, initial: initial),
         initialChildren: children,
       );

  static const String name = 'ProfileEditPersonalRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<ProfileEditPersonalRouteArgs>();
      return _i16.ProfileEditPersonalPage(key: args.key, initial: args.initial);
    },
  );
}

class ProfileEditPersonalRouteArgs {
  const ProfileEditPersonalRouteArgs({this.key, required this.initial});

  final _i22.Key? key;

  final _i27.ProfilePersonalDraft initial;

  @override
  String toString() {
    return 'ProfileEditPersonalRouteArgs{key: $key, initial: $initial}';
  }
}

/// generated route for
/// [_i16.ProfilePage]
class ProfileRoute extends _i21.PageRouteInfo<void> {
  const ProfileRoute({List<_i21.PageRouteInfo>? children})
    : super(ProfileRoute.name, initialChildren: children);

  static const String name = 'ProfileRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      return const _i16.ProfilePage();
    },
  );
}

/// generated route for
/// [_i17.SavedOffersPage]
class SavedOffersRoute extends _i21.PageRouteInfo<SavedOffersRouteArgs> {
  SavedOffersRoute({
    _i22.Key? key,
    bool fromTab = false,
    List<_i21.PageRouteInfo>? children,
  }) : super(
         SavedOffersRoute.name,
         args: SavedOffersRouteArgs(key: key, fromTab: fromTab),
         initialChildren: children,
       );

  static const String name = 'SavedOffersRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<SavedOffersRouteArgs>(
        orElse: () => const SavedOffersRouteArgs(),
      );
      return _i17.SavedOffersPage(key: args.key, fromTab: args.fromTab);
    },
  );
}

class SavedOffersRouteArgs {
  const SavedOffersRouteArgs({this.key, this.fromTab = false});

  final _i22.Key? key;

  final bool fromTab;

  @override
  String toString() {
    return 'SavedOffersRouteArgs{key: $key, fromTab: $fromTab}';
  }
}

/// generated route for
/// [_i18.SettingsSecurityPage]
class SettingsSecurityRoute extends _i21.PageRouteInfo<void> {
  const SettingsSecurityRoute({List<_i21.PageRouteInfo>? children})
    : super(SettingsSecurityRoute.name, initialChildren: children);

  static const String name = 'SettingsSecurityRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      return const _i18.SettingsSecurityPage();
    },
  );
}

/// generated route for
/// [_i19.SignupPage]
class SignupRoute extends _i21.PageRouteInfo<void> {
  const SignupRoute({List<_i21.PageRouteInfo>? children})
    : super(SignupRoute.name, initialChildren: children);

  static const String name = 'SignupRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      return const _i19.SignupPage();
    },
  );
}

/// generated route for
/// [_i20.SplashPage]
class SplashRoute extends _i21.PageRouteInfo<void> {
  const SplashRoute({List<_i21.PageRouteInfo>? children})
    : super(SplashRoute.name, initialChildren: children);

  static const String name = 'SplashRoute';

  static _i21.PageInfo page = _i21.PageInfo(
    name,
    builder: (data) {
      return const _i20.SplashPage();
    },
  );
}
