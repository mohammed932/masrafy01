// dart format width=80
// GENERATED CODE - DO NOT MODIFY BY HAND

// **************************************************************************
// AutoRouterGenerator
// **************************************************************************

// ignore_for_file: type=lint
// coverage:ignore-file

// ignore_for_file: no_leading_underscores_for_library_prefixes
import 'package:app/core/features/biometric/presentation/biometric_lock_page.dart'
    as _i2;
import 'package:app/core/features/id_capture/presentation/id_capture_page.dart'
    as _i8;
import 'package:app/core/widgets/common/masrafy_app_bottom_nav.dart' as _i28;
import 'package:app/features/account/presentation/pages/settings_security/settings_security.imports.dart'
    as _i21;
import 'package:app/features/applications/presentation/pages/previous_applications/previous_applications.imports.dart'
    as _i18;
import 'package:app/features/auth/domain/entities/otp_challenge_entity.dart'
    as _i30;
import 'package:app/features/auth/domain/entities/signup_draft.dart' as _i26;
import 'package:app/features/auth/domain/enums/otp_purpose.dart' as _i31;
import 'package:app/features/auth/presentation/pages/apply_documents/apply_documents.imports.dart'
    as _i1;
import 'package:app/features/auth/presentation/pages/change_password/change_password.imports.dart'
    as _i5;
import 'package:app/features/auth/presentation/pages/complete_profile/complete_profile.imports.dart'
    as _i6;
import 'package:app/features/auth/presentation/pages/forgot_password/forgot_password.imports.dart'
    as _i7;
import 'package:app/features/auth/presentation/pages/login/login.imports.dart'
    as _i9;
import 'package:app/features/auth/presentation/pages/otp/otp.imports.dart'
    as _i15;
import 'package:app/features/auth/presentation/pages/phone_verification/phone_verification.imports.dart'
    as _i17;
import 'package:app/features/auth/presentation/pages/signup/signup.imports.dart'
    as _i22;
import 'package:app/features/offers/presentation/models/match_results_args.dart'
    as _i29;
import 'package:app/features/offers/presentation/pages/offer_details/offer_details.imports.dart'
    as _i13;
import 'package:app/features/offers/presentation/pages/results/results.imports.dart'
    as _i11;
import 'package:app/features/onboarding/presentation/pages/onboarding/onboarding.imports.dart'
    as _i14;
import 'package:app/features/profile/presentation/models/profile_data.dart'
    as _i32;
import 'package:app/features/profile/presentation/pages/profile/profile.imports.dart'
    as _i19;
import 'package:app/features/questionnaire/presentation/pages/business/business_questionnaire_page.dart'
    as _i3;
import 'package:app/features/questionnaire/presentation/pages/car/car_questionnaire_page.dart'
    as _i4;
import 'package:app/features/questionnaire/presentation/pages/mortgage/mortgage_questionnaire_page.dart'
    as _i12;
import 'package:app/features/questionnaire/presentation/pages/personal/personal_questionnaire_page.dart'
    as _i16;
import 'package:app/features/saved_offers/presentation/pages/saved_offers/saved_offers.imports.dart'
    as _i20;
import 'package:app/features/shell/presentation/pages/main_shell/main_shell.imports.dart'
    as _i10;
import 'package:app/features/splash/presentation/pages/splash/splash.imports.dart'
    as _i23;
import 'package:auto_route/auto_route.dart' as _i24;
import 'package:flutter/foundation.dart' as _i27;
import 'package:flutter/material.dart' as _i25;

/// generated route for
/// [_i1.ApplyDocumentsPage]
class ApplyDocumentsRoute extends _i24.PageRouteInfo<void> {
  const ApplyDocumentsRoute({List<_i24.PageRouteInfo>? children})
    : super(ApplyDocumentsRoute.name, initialChildren: children);

  static const String name = 'ApplyDocumentsRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      return const _i1.ApplyDocumentsPage();
    },
  );
}

/// generated route for
/// [_i2.BiometricLockPage]
class BiometricLockRoute extends _i24.PageRouteInfo<void> {
  const BiometricLockRoute({List<_i24.PageRouteInfo>? children})
    : super(BiometricLockRoute.name, initialChildren: children);

  static const String name = 'BiometricLockRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      return const _i2.BiometricLockPage();
    },
  );
}

/// generated route for
/// [_i3.BusinessQuestionnairePage]
class BusinessQuestionnaireRoute
    extends _i24.PageRouteInfo<BusinessQuestionnaireRouteArgs> {
  BusinessQuestionnaireRoute({
    _i25.Key? key,
    String? programNameKey,
    List<_i24.PageRouteInfo>? children,
  }) : super(
         BusinessQuestionnaireRoute.name,
         args: BusinessQuestionnaireRouteArgs(
           key: key,
           programNameKey: programNameKey,
         ),
         initialChildren: children,
       );

  static const String name = 'BusinessQuestionnaireRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<BusinessQuestionnaireRouteArgs>(
        orElse: () => const BusinessQuestionnaireRouteArgs(),
      );
      return _i3.BusinessQuestionnairePage(
        key: args.key,
        programNameKey: args.programNameKey,
      );
    },
  );
}

class BusinessQuestionnaireRouteArgs {
  const BusinessQuestionnaireRouteArgs({this.key, this.programNameKey});

  final _i25.Key? key;

  final String? programNameKey;

  @override
  String toString() {
    return 'BusinessQuestionnaireRouteArgs{key: $key, programNameKey: $programNameKey}';
  }
}

/// generated route for
/// [_i4.CarQuestionnairePage]
class CarQuestionnaireRoute
    extends _i24.PageRouteInfo<CarQuestionnaireRouteArgs> {
  CarQuestionnaireRoute({
    _i25.Key? key,
    String? programNameKey,
    List<_i24.PageRouteInfo>? children,
  }) : super(
         CarQuestionnaireRoute.name,
         args: CarQuestionnaireRouteArgs(
           key: key,
           programNameKey: programNameKey,
         ),
         initialChildren: children,
       );

  static const String name = 'CarQuestionnaireRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<CarQuestionnaireRouteArgs>(
        orElse: () => const CarQuestionnaireRouteArgs(),
      );
      return _i4.CarQuestionnairePage(
        key: args.key,
        programNameKey: args.programNameKey,
      );
    },
  );
}

class CarQuestionnaireRouteArgs {
  const CarQuestionnaireRouteArgs({this.key, this.programNameKey});

  final _i25.Key? key;

  final String? programNameKey;

  @override
  String toString() {
    return 'CarQuestionnaireRouteArgs{key: $key, programNameKey: $programNameKey}';
  }
}

/// generated route for
/// [_i5.ChangePasswordPage]
class ChangePasswordRoute extends _i24.PageRouteInfo<void> {
  const ChangePasswordRoute({List<_i24.PageRouteInfo>? children})
    : super(ChangePasswordRoute.name, initialChildren: children);

  static const String name = 'ChangePasswordRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      return const _i5.ChangePasswordPage();
    },
  );
}

/// generated route for
/// [_i6.CompleteProfilePage]
class CompleteProfileRoute
    extends _i24.PageRouteInfo<CompleteProfileRouteArgs> {
  CompleteProfileRoute({
    _i25.Key? key,
    _i26.SignupDraft? draft,
    List<_i24.PageRouteInfo>? children,
  }) : super(
         CompleteProfileRoute.name,
         args: CompleteProfileRouteArgs(key: key, draft: draft),
         initialChildren: children,
       );

  static const String name = 'CompleteProfileRoute';

  static _i24.PageInfo page = _i24.PageInfo(
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

  final _i25.Key? key;

  final _i26.SignupDraft? draft;

  @override
  String toString() {
    return 'CompleteProfileRouteArgs{key: $key, draft: $draft}';
  }
}

/// generated route for
/// [_i7.ForgotPasswordPage]
class ForgotPasswordRoute extends _i24.PageRouteInfo<void> {
  const ForgotPasswordRoute({List<_i24.PageRouteInfo>? children})
    : super(ForgotPasswordRoute.name, initialChildren: children);

  static const String name = 'ForgotPasswordRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      return const _i7.ForgotPasswordPage();
    },
  );
}

/// generated route for
/// [_i8.IdCapturePage]
class IdCaptureRoute extends _i24.PageRouteInfo<IdCaptureRouteArgs> {
  IdCaptureRoute({
    _i27.Key? key,
    required _i8.IdCaptureSide side,
    List<_i24.PageRouteInfo>? children,
  }) : super(
         IdCaptureRoute.name,
         args: IdCaptureRouteArgs(key: key, side: side),
         initialChildren: children,
       );

  static const String name = 'IdCaptureRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<IdCaptureRouteArgs>();
      return _i8.IdCapturePage(key: args.key, side: args.side);
    },
  );
}

class IdCaptureRouteArgs {
  const IdCaptureRouteArgs({this.key, required this.side});

  final _i27.Key? key;

  final _i8.IdCaptureSide side;

  @override
  String toString() {
    return 'IdCaptureRouteArgs{key: $key, side: $side}';
  }
}

/// generated route for
/// [_i9.LoginPage]
class LoginRoute extends _i24.PageRouteInfo<void> {
  const LoginRoute({List<_i24.PageRouteInfo>? children})
    : super(LoginRoute.name, initialChildren: children);

  static const String name = 'LoginRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      return const _i9.LoginPage();
    },
  );
}

/// generated route for
/// [_i10.MainShellPage]
class MainShellRoute extends _i24.PageRouteInfo<MainShellRouteArgs> {
  MainShellRoute({
    _i25.Key? key,
    _i28.MasrafyAppNavTab initialTab = _i28.MasrafyAppNavTab.home,
    List<_i24.PageRouteInfo>? children,
  }) : super(
         MainShellRoute.name,
         args: MainShellRouteArgs(key: key, initialTab: initialTab),
         initialChildren: children,
       );

  static const String name = 'MainShellRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<MainShellRouteArgs>(
        orElse: () => const MainShellRouteArgs(),
      );
      return _i10.MainShellPage(key: args.key, initialTab: args.initialTab);
    },
  );
}

class MainShellRouteArgs {
  const MainShellRouteArgs({
    this.key,
    this.initialTab = _i28.MasrafyAppNavTab.home,
  });

  final _i25.Key? key;

  final _i28.MasrafyAppNavTab initialTab;

  @override
  String toString() {
    return 'MainShellRouteArgs{key: $key, initialTab: $initialTab}';
  }
}

/// generated route for
/// [_i11.MatchResultsPage]
class MatchResultsRoute extends _i24.PageRouteInfo<MatchResultsRouteArgs> {
  MatchResultsRoute({
    _i25.Key? key,
    required _i29.MatchResultsArgs args,
    List<_i24.PageRouteInfo>? children,
  }) : super(
         MatchResultsRoute.name,
         args: MatchResultsRouteArgs(key: key, args: args),
         initialChildren: children,
       );

  static const String name = 'MatchResultsRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<MatchResultsRouteArgs>();
      return _i11.MatchResultsPage(key: args.key, args: args.args);
    },
  );
}

class MatchResultsRouteArgs {
  const MatchResultsRouteArgs({this.key, required this.args});

  final _i25.Key? key;

  final _i29.MatchResultsArgs args;

  @override
  String toString() {
    return 'MatchResultsRouteArgs{key: $key, args: $args}';
  }
}

/// generated route for
/// [_i12.MortgageQuestionnairePage]
class MortgageQuestionnaireRoute
    extends _i24.PageRouteInfo<MortgageQuestionnaireRouteArgs> {
  MortgageQuestionnaireRoute({
    _i25.Key? key,
    String? programNameKey,
    List<_i24.PageRouteInfo>? children,
  }) : super(
         MortgageQuestionnaireRoute.name,
         args: MortgageQuestionnaireRouteArgs(
           key: key,
           programNameKey: programNameKey,
         ),
         initialChildren: children,
       );

  static const String name = 'MortgageQuestionnaireRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<MortgageQuestionnaireRouteArgs>(
        orElse: () => const MortgageQuestionnaireRouteArgs(),
      );
      return _i12.MortgageQuestionnairePage(
        key: args.key,
        programNameKey: args.programNameKey,
      );
    },
  );
}

class MortgageQuestionnaireRouteArgs {
  const MortgageQuestionnaireRouteArgs({this.key, this.programNameKey});

  final _i25.Key? key;

  final String? programNameKey;

  @override
  String toString() {
    return 'MortgageQuestionnaireRouteArgs{key: $key, programNameKey: $programNameKey}';
  }
}

/// generated route for
/// [_i13.OfferDetailsPage]
class OfferDetailsRoute extends _i24.PageRouteInfo<OfferDetailsRouteArgs> {
  OfferDetailsRoute({
    _i25.Key? key,
    required _i29.MatchOffer offer,
    required _i29.MatchResultsArgs summary,
    List<_i24.PageRouteInfo>? children,
  }) : super(
         OfferDetailsRoute.name,
         args: OfferDetailsRouteArgs(key: key, offer: offer, summary: summary),
         initialChildren: children,
       );

  static const String name = 'OfferDetailsRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<OfferDetailsRouteArgs>();
      return _i13.OfferDetailsPage(
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

  final _i25.Key? key;

  final _i29.MatchOffer offer;

  final _i29.MatchResultsArgs summary;

  @override
  String toString() {
    return 'OfferDetailsRouteArgs{key: $key, offer: $offer, summary: $summary}';
  }
}

/// generated route for
/// [_i14.OnboardingPage]
class OnboardingRoute extends _i24.PageRouteInfo<void> {
  const OnboardingRoute({List<_i24.PageRouteInfo>? children})
    : super(OnboardingRoute.name, initialChildren: children);

  static const String name = 'OnboardingRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      return const _i14.OnboardingPage();
    },
  );
}

/// generated route for
/// [_i15.OtpPage]
class OtpRoute extends _i24.PageRouteInfo<OtpRouteArgs> {
  OtpRoute({
    _i25.Key? key,
    required _i30.OtpChallengeEntity challenge,
    required _i31.OtpPurpose purpose,
    _i26.SignupDraft? draft,
    String? phone,
    List<_i24.PageRouteInfo>? children,
  }) : super(
         OtpRoute.name,
         args: OtpRouteArgs(
           key: key,
           challenge: challenge,
           purpose: purpose,
           draft: draft,
           phone: phone,
         ),
         initialChildren: children,
       );

  static const String name = 'OtpRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<OtpRouteArgs>();
      return _i15.OtpPage(
        key: args.key,
        challenge: args.challenge,
        purpose: args.purpose,
        draft: args.draft,
        phone: args.phone,
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
    this.phone,
  });

  final _i25.Key? key;

  final _i30.OtpChallengeEntity challenge;

  final _i31.OtpPurpose purpose;

  final _i26.SignupDraft? draft;

  final String? phone;

  @override
  String toString() {
    return 'OtpRouteArgs{key: $key, challenge: $challenge, purpose: $purpose, draft: $draft, phone: $phone}';
  }
}

/// generated route for
/// [_i16.PersonalQuestionnairePage]
class PersonalQuestionnaireRoute
    extends _i24.PageRouteInfo<PersonalQuestionnaireRouteArgs> {
  PersonalQuestionnaireRoute({
    _i25.Key? key,
    String? programNameKey,
    List<_i24.PageRouteInfo>? children,
  }) : super(
         PersonalQuestionnaireRoute.name,
         args: PersonalQuestionnaireRouteArgs(
           key: key,
           programNameKey: programNameKey,
         ),
         initialChildren: children,
       );

  static const String name = 'PersonalQuestionnaireRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<PersonalQuestionnaireRouteArgs>(
        orElse: () => const PersonalQuestionnaireRouteArgs(),
      );
      return _i16.PersonalQuestionnairePage(
        key: args.key,
        programNameKey: args.programNameKey,
      );
    },
  );
}

class PersonalQuestionnaireRouteArgs {
  const PersonalQuestionnaireRouteArgs({this.key, this.programNameKey});

  final _i25.Key? key;

  final String? programNameKey;

  @override
  String toString() {
    return 'PersonalQuestionnaireRouteArgs{key: $key, programNameKey: $programNameKey}';
  }
}

/// generated route for
/// [_i17.PhoneVerificationPage]
class PhoneVerificationRoute extends _i24.PageRouteInfo<void> {
  const PhoneVerificationRoute({List<_i24.PageRouteInfo>? children})
    : super(PhoneVerificationRoute.name, initialChildren: children);

  static const String name = 'PhoneVerificationRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      return const _i17.PhoneVerificationPage();
    },
  );
}

/// generated route for
/// [_i18.PreviousApplicationsPage]
class PreviousApplicationsRoute extends _i24.PageRouteInfo<void> {
  const PreviousApplicationsRoute({List<_i24.PageRouteInfo>? children})
    : super(PreviousApplicationsRoute.name, initialChildren: children);

  static const String name = 'PreviousApplicationsRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      return const _i18.PreviousApplicationsPage();
    },
  );
}

/// generated route for
/// [_i19.ProfileEditContactPage]
class ProfileEditContactRoute
    extends _i24.PageRouteInfo<ProfileEditContactRouteArgs> {
  ProfileEditContactRoute({
    _i25.Key? key,
    required _i32.ProfileContactDraft initial,
    List<_i24.PageRouteInfo>? children,
  }) : super(
         ProfileEditContactRoute.name,
         args: ProfileEditContactRouteArgs(key: key, initial: initial),
         initialChildren: children,
       );

  static const String name = 'ProfileEditContactRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<ProfileEditContactRouteArgs>();
      return _i19.ProfileEditContactPage(key: args.key, initial: args.initial);
    },
  );
}

class ProfileEditContactRouteArgs {
  const ProfileEditContactRouteArgs({this.key, required this.initial});

  final _i25.Key? key;

  final _i32.ProfileContactDraft initial;

  @override
  String toString() {
    return 'ProfileEditContactRouteArgs{key: $key, initial: $initial}';
  }
}

/// generated route for
/// [_i19.ProfileEditPersonalPage]
class ProfileEditPersonalRoute
    extends _i24.PageRouteInfo<ProfileEditPersonalRouteArgs> {
  ProfileEditPersonalRoute({
    _i25.Key? key,
    required _i32.ProfilePersonalDraft initial,
    List<_i24.PageRouteInfo>? children,
  }) : super(
         ProfileEditPersonalRoute.name,
         args: ProfileEditPersonalRouteArgs(key: key, initial: initial),
         initialChildren: children,
       );

  static const String name = 'ProfileEditPersonalRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<ProfileEditPersonalRouteArgs>();
      return _i19.ProfileEditPersonalPage(key: args.key, initial: args.initial);
    },
  );
}

class ProfileEditPersonalRouteArgs {
  const ProfileEditPersonalRouteArgs({this.key, required this.initial});

  final _i25.Key? key;

  final _i32.ProfilePersonalDraft initial;

  @override
  String toString() {
    return 'ProfileEditPersonalRouteArgs{key: $key, initial: $initial}';
  }
}

/// generated route for
/// [_i19.ProfilePage]
class ProfileRoute extends _i24.PageRouteInfo<void> {
  const ProfileRoute({List<_i24.PageRouteInfo>? children})
    : super(ProfileRoute.name, initialChildren: children);

  static const String name = 'ProfileRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      return const _i19.ProfilePage();
    },
  );
}

/// generated route for
/// [_i20.SavedOffersPage]
class SavedOffersRoute extends _i24.PageRouteInfo<SavedOffersRouteArgs> {
  SavedOffersRoute({
    _i25.Key? key,
    bool fromTab = false,
    List<_i24.PageRouteInfo>? children,
  }) : super(
         SavedOffersRoute.name,
         args: SavedOffersRouteArgs(key: key, fromTab: fromTab),
         initialChildren: children,
       );

  static const String name = 'SavedOffersRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<SavedOffersRouteArgs>(
        orElse: () => const SavedOffersRouteArgs(),
      );
      return _i20.SavedOffersPage(key: args.key, fromTab: args.fromTab);
    },
  );
}

class SavedOffersRouteArgs {
  const SavedOffersRouteArgs({this.key, this.fromTab = false});

  final _i25.Key? key;

  final bool fromTab;

  @override
  String toString() {
    return 'SavedOffersRouteArgs{key: $key, fromTab: $fromTab}';
  }
}

/// generated route for
/// [_i21.SettingsSecurityPage]
class SettingsSecurityRoute extends _i24.PageRouteInfo<void> {
  const SettingsSecurityRoute({List<_i24.PageRouteInfo>? children})
    : super(SettingsSecurityRoute.name, initialChildren: children);

  static const String name = 'SettingsSecurityRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      return const _i21.SettingsSecurityPage();
    },
  );
}

/// generated route for
/// [_i22.SignupPage]
class SignupRoute extends _i24.PageRouteInfo<void> {
  const SignupRoute({List<_i24.PageRouteInfo>? children})
    : super(SignupRoute.name, initialChildren: children);

  static const String name = 'SignupRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      return const _i22.SignupPage();
    },
  );
}

/// generated route for
/// [_i23.SplashPage]
class SplashRoute extends _i24.PageRouteInfo<void> {
  const SplashRoute({List<_i24.PageRouteInfo>? children})
    : super(SplashRoute.name, initialChildren: children);

  static const String name = 'SplashRoute';

  static _i24.PageInfo page = _i24.PageInfo(
    name,
    builder: (data) {
      return const _i23.SplashPage();
    },
  );
}
