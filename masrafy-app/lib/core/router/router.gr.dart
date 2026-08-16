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
import 'package:app/core/widgets/common/masrafy_app_bottom_nav.dart' as _i29;
import 'package:app/features/account/presentation/pages/settings_security/settings_security.imports.dart'
    as _i22;
import 'package:app/features/applications/presentation/pages/previous_applications/previous_applications.imports.dart'
    as _i19;
import 'package:app/features/auth/domain/entities/otp_challenge_entity.dart'
    as _i31;
import 'package:app/features/auth/domain/entities/signup_draft.dart' as _i27;
import 'package:app/features/auth/domain/enums/otp_purpose.dart' as _i32;
import 'package:app/features/auth/presentation/pages/apply_documents/apply_documents.imports.dart'
    as _i1;
import 'package:app/features/auth/presentation/pages/change_password/change_password.imports.dart'
    as _i5;
import 'package:app/features/auth/presentation/pages/complete_profile/complete_profile.imports.dart'
    as _i6;
import 'package:app/features/auth/presentation/pages/forgot_password/forgot_password.imports.dart'
    as _i7;
import 'package:app/features/auth/presentation/pages/login/login.imports.dart'
    as _i10;
import 'package:app/features/auth/presentation/pages/otp/otp.imports.dart'
    as _i16;
import 'package:app/features/auth/presentation/pages/phone_verification/phone_verification.imports.dart'
    as _i18;
import 'package:app/features/auth/presentation/pages/signup/signup.imports.dart'
    as _i23;
import 'package:app/features/loan_setup/presentation/pages/loan_setup/loan_setup.imports.dart'
    as _i9;
import 'package:app/features/offers/presentation/models/match_results_args.dart'
    as _i30;
import 'package:app/features/offers/presentation/pages/offer_details/offer_details.imports.dart'
    as _i14;
import 'package:app/features/offers/presentation/pages/results/results.imports.dart'
    as _i12;
import 'package:app/features/onboarding/presentation/pages/onboarding/onboarding.imports.dart'
    as _i15;
import 'package:app/features/profile/presentation/models/profile_data.dart'
    as _i33;
import 'package:app/features/profile/presentation/pages/profile/profile.imports.dart'
    as _i20;
import 'package:app/features/questionnaire/presentation/pages/business/business_questionnaire_page.dart'
    as _i3;
import 'package:app/features/questionnaire/presentation/pages/car/car_questionnaire_page.dart'
    as _i4;
import 'package:app/features/questionnaire/presentation/pages/mortgage/mortgage_questionnaire_page.dart'
    as _i13;
import 'package:app/features/questionnaire/presentation/pages/personal/personal_questionnaire_page.dart'
    as _i17;
import 'package:app/features/saved_offers/presentation/pages/saved_offers/saved_offers.imports.dart'
    as _i21;
import 'package:app/features/shell/presentation/pages/main_shell/main_shell.imports.dart'
    as _i11;
import 'package:app/features/splash/presentation/pages/splash/splash.imports.dart'
    as _i24;
import 'package:auto_route/auto_route.dart' as _i25;
import 'package:flutter/foundation.dart' as _i28;
import 'package:flutter/material.dart' as _i26;

/// generated route for
/// [_i1.ApplyDocumentsPage]
class ApplyDocumentsRoute extends _i25.PageRouteInfo<void> {
  const ApplyDocumentsRoute({List<_i25.PageRouteInfo>? children})
    : super(ApplyDocumentsRoute.name, initialChildren: children);

  static const String name = 'ApplyDocumentsRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      return const _i1.ApplyDocumentsPage();
    },
  );
}

/// generated route for
/// [_i2.BiometricLockPage]
class BiometricLockRoute extends _i25.PageRouteInfo<void> {
  const BiometricLockRoute({List<_i25.PageRouteInfo>? children})
    : super(BiometricLockRoute.name, initialChildren: children);

  static const String name = 'BiometricLockRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      return const _i2.BiometricLockPage();
    },
  );
}

/// generated route for
/// [_i3.BusinessQuestionnairePage]
class BusinessQuestionnaireRoute
    extends _i25.PageRouteInfo<BusinessQuestionnaireRouteArgs> {
  BusinessQuestionnaireRoute({
    _i26.Key? key,
    String? programNameKey,
    String? incomeType,
    List<_i25.PageRouteInfo>? children,
  }) : super(
         BusinessQuestionnaireRoute.name,
         args: BusinessQuestionnaireRouteArgs(
           key: key,
           programNameKey: programNameKey,
           incomeType: incomeType,
         ),
         initialChildren: children,
       );

  static const String name = 'BusinessQuestionnaireRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<BusinessQuestionnaireRouteArgs>(
        orElse: () => const BusinessQuestionnaireRouteArgs(),
      );
      return _i3.BusinessQuestionnairePage(
        key: args.key,
        programNameKey: args.programNameKey,
        incomeType: args.incomeType,
      );
    },
  );
}

class BusinessQuestionnaireRouteArgs {
  const BusinessQuestionnaireRouteArgs({
    this.key,
    this.programNameKey,
    this.incomeType,
  });

  final _i26.Key? key;

  final String? programNameKey;

  final String? incomeType;

  @override
  String toString() {
    return 'BusinessQuestionnaireRouteArgs{key: $key, programNameKey: $programNameKey, incomeType: $incomeType}';
  }
}

/// generated route for
/// [_i4.CarQuestionnairePage]
class CarQuestionnaireRoute
    extends _i25.PageRouteInfo<CarQuestionnaireRouteArgs> {
  CarQuestionnaireRoute({
    _i26.Key? key,
    String? programNameKey,
    String? incomeType,
    List<_i25.PageRouteInfo>? children,
  }) : super(
         CarQuestionnaireRoute.name,
         args: CarQuestionnaireRouteArgs(
           key: key,
           programNameKey: programNameKey,
           incomeType: incomeType,
         ),
         initialChildren: children,
       );

  static const String name = 'CarQuestionnaireRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<CarQuestionnaireRouteArgs>(
        orElse: () => const CarQuestionnaireRouteArgs(),
      );
      return _i4.CarQuestionnairePage(
        key: args.key,
        programNameKey: args.programNameKey,
        incomeType: args.incomeType,
      );
    },
  );
}

class CarQuestionnaireRouteArgs {
  const CarQuestionnaireRouteArgs({
    this.key,
    this.programNameKey,
    this.incomeType,
  });

  final _i26.Key? key;

  final String? programNameKey;

  final String? incomeType;

  @override
  String toString() {
    return 'CarQuestionnaireRouteArgs{key: $key, programNameKey: $programNameKey, incomeType: $incomeType}';
  }
}

/// generated route for
/// [_i5.ChangePasswordPage]
class ChangePasswordRoute extends _i25.PageRouteInfo<void> {
  const ChangePasswordRoute({List<_i25.PageRouteInfo>? children})
    : super(ChangePasswordRoute.name, initialChildren: children);

  static const String name = 'ChangePasswordRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      return const _i5.ChangePasswordPage();
    },
  );
}

/// generated route for
/// [_i6.CompleteProfilePage]
class CompleteProfileRoute
    extends _i25.PageRouteInfo<CompleteProfileRouteArgs> {
  CompleteProfileRoute({
    _i26.Key? key,
    _i27.SignupDraft? draft,
    List<_i25.PageRouteInfo>? children,
  }) : super(
         CompleteProfileRoute.name,
         args: CompleteProfileRouteArgs(key: key, draft: draft),
         initialChildren: children,
       );

  static const String name = 'CompleteProfileRoute';

  static _i25.PageInfo page = _i25.PageInfo(
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

  final _i26.Key? key;

  final _i27.SignupDraft? draft;

  @override
  String toString() {
    return 'CompleteProfileRouteArgs{key: $key, draft: $draft}';
  }
}

/// generated route for
/// [_i7.ForgotPasswordPage]
class ForgotPasswordRoute extends _i25.PageRouteInfo<void> {
  const ForgotPasswordRoute({List<_i25.PageRouteInfo>? children})
    : super(ForgotPasswordRoute.name, initialChildren: children);

  static const String name = 'ForgotPasswordRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      return const _i7.ForgotPasswordPage();
    },
  );
}

/// generated route for
/// [_i8.IdCapturePage]
class IdCaptureRoute extends _i25.PageRouteInfo<IdCaptureRouteArgs> {
  IdCaptureRoute({
    _i28.Key? key,
    required _i8.IdCaptureSide side,
    List<_i25.PageRouteInfo>? children,
  }) : super(
         IdCaptureRoute.name,
         args: IdCaptureRouteArgs(key: key, side: side),
         initialChildren: children,
       );

  static const String name = 'IdCaptureRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<IdCaptureRouteArgs>();
      return _i8.IdCapturePage(key: args.key, side: args.side);
    },
  );
}

class IdCaptureRouteArgs {
  const IdCaptureRouteArgs({this.key, required this.side});

  final _i28.Key? key;

  final _i8.IdCaptureSide side;

  @override
  String toString() {
    return 'IdCaptureRouteArgs{key: $key, side: $side}';
  }
}

/// generated route for
/// [_i9.LoanSetupPage]
class LoanSetupRoute extends _i25.PageRouteInfo<LoanSetupRouteArgs> {
  LoanSetupRoute({
    _i26.Key? key,
    required String categoryCode,
    List<_i25.PageRouteInfo>? children,
  }) : super(
         LoanSetupRoute.name,
         args: LoanSetupRouteArgs(key: key, categoryCode: categoryCode),
         initialChildren: children,
       );

  static const String name = 'LoanSetupRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<LoanSetupRouteArgs>();
      return _i9.LoanSetupPage(key: args.key, categoryCode: args.categoryCode);
    },
  );
}

class LoanSetupRouteArgs {
  const LoanSetupRouteArgs({this.key, required this.categoryCode});

  final _i26.Key? key;

  final String categoryCode;

  @override
  String toString() {
    return 'LoanSetupRouteArgs{key: $key, categoryCode: $categoryCode}';
  }
}

/// generated route for
/// [_i10.LoginPage]
class LoginRoute extends _i25.PageRouteInfo<void> {
  const LoginRoute({List<_i25.PageRouteInfo>? children})
    : super(LoginRoute.name, initialChildren: children);

  static const String name = 'LoginRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      return const _i10.LoginPage();
    },
  );
}

/// generated route for
/// [_i11.MainShellPage]
class MainShellRoute extends _i25.PageRouteInfo<MainShellRouteArgs> {
  MainShellRoute({
    _i26.Key? key,
    _i29.MasrafyAppNavTab initialTab = _i29.MasrafyAppNavTab.home,
    List<_i25.PageRouteInfo>? children,
  }) : super(
         MainShellRoute.name,
         args: MainShellRouteArgs(key: key, initialTab: initialTab),
         initialChildren: children,
       );

  static const String name = 'MainShellRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<MainShellRouteArgs>(
        orElse: () => const MainShellRouteArgs(),
      );
      return _i11.MainShellPage(key: args.key, initialTab: args.initialTab);
    },
  );
}

class MainShellRouteArgs {
  const MainShellRouteArgs({
    this.key,
    this.initialTab = _i29.MasrafyAppNavTab.home,
  });

  final _i26.Key? key;

  final _i29.MasrafyAppNavTab initialTab;

  @override
  String toString() {
    return 'MainShellRouteArgs{key: $key, initialTab: $initialTab}';
  }
}

/// generated route for
/// [_i12.MatchResultsPage]
class MatchResultsRoute extends _i25.PageRouteInfo<MatchResultsRouteArgs> {
  MatchResultsRoute({
    _i26.Key? key,
    required _i30.MatchResultsArgs args,
    List<_i25.PageRouteInfo>? children,
  }) : super(
         MatchResultsRoute.name,
         args: MatchResultsRouteArgs(key: key, args: args),
         initialChildren: children,
       );

  static const String name = 'MatchResultsRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<MatchResultsRouteArgs>();
      return _i12.MatchResultsPage(key: args.key, args: args.args);
    },
  );
}

class MatchResultsRouteArgs {
  const MatchResultsRouteArgs({this.key, required this.args});

  final _i26.Key? key;

  final _i30.MatchResultsArgs args;

  @override
  String toString() {
    return 'MatchResultsRouteArgs{key: $key, args: $args}';
  }
}

/// generated route for
/// [_i13.MortgageQuestionnairePage]
class MortgageQuestionnaireRoute
    extends _i25.PageRouteInfo<MortgageQuestionnaireRouteArgs> {
  MortgageQuestionnaireRoute({
    _i26.Key? key,
    String? programNameKey,
    String? incomeType,
    List<_i25.PageRouteInfo>? children,
  }) : super(
         MortgageQuestionnaireRoute.name,
         args: MortgageQuestionnaireRouteArgs(
           key: key,
           programNameKey: programNameKey,
           incomeType: incomeType,
         ),
         initialChildren: children,
       );

  static const String name = 'MortgageQuestionnaireRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<MortgageQuestionnaireRouteArgs>(
        orElse: () => const MortgageQuestionnaireRouteArgs(),
      );
      return _i13.MortgageQuestionnairePage(
        key: args.key,
        programNameKey: args.programNameKey,
        incomeType: args.incomeType,
      );
    },
  );
}

class MortgageQuestionnaireRouteArgs {
  const MortgageQuestionnaireRouteArgs({
    this.key,
    this.programNameKey,
    this.incomeType,
  });

  final _i26.Key? key;

  final String? programNameKey;

  final String? incomeType;

  @override
  String toString() {
    return 'MortgageQuestionnaireRouteArgs{key: $key, programNameKey: $programNameKey, incomeType: $incomeType}';
  }
}

/// generated route for
/// [_i14.OfferDetailsPage]
class OfferDetailsRoute extends _i25.PageRouteInfo<OfferDetailsRouteArgs> {
  OfferDetailsRoute({
    _i26.Key? key,
    String? applicationId,
    _i30.MatchOffer? offer,
    _i30.MatchResultsArgs? summary,
    List<_i25.PageRouteInfo>? children,
  }) : super(
         OfferDetailsRoute.name,
         args: OfferDetailsRouteArgs(
           key: key,
           applicationId: applicationId,
           offer: offer,
           summary: summary,
         ),
         initialChildren: children,
       );

  static const String name = 'OfferDetailsRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<OfferDetailsRouteArgs>(
        orElse: () => const OfferDetailsRouteArgs(),
      );
      return _i14.OfferDetailsPage(
        key: args.key,
        applicationId: args.applicationId,
        offer: args.offer,
        summary: args.summary,
      );
    },
  );
}

class OfferDetailsRouteArgs {
  const OfferDetailsRouteArgs({
    this.key,
    this.applicationId,
    this.offer,
    this.summary,
  });

  final _i26.Key? key;

  final String? applicationId;

  final _i30.MatchOffer? offer;

  final _i30.MatchResultsArgs? summary;

  @override
  String toString() {
    return 'OfferDetailsRouteArgs{key: $key, applicationId: $applicationId, offer: $offer, summary: $summary}';
  }
}

/// generated route for
/// [_i15.OnboardingPage]
class OnboardingRoute extends _i25.PageRouteInfo<void> {
  const OnboardingRoute({List<_i25.PageRouteInfo>? children})
    : super(OnboardingRoute.name, initialChildren: children);

  static const String name = 'OnboardingRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      return const _i15.OnboardingPage();
    },
  );
}

/// generated route for
/// [_i16.OtpPage]
class OtpRoute extends _i25.PageRouteInfo<OtpRouteArgs> {
  OtpRoute({
    _i26.Key? key,
    required _i31.OtpChallengeEntity challenge,
    required _i32.OtpPurpose purpose,
    _i27.SignupDraft? draft,
    String? phone,
    List<_i25.PageRouteInfo>? children,
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

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<OtpRouteArgs>();
      return _i16.OtpPage(
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

  final _i26.Key? key;

  final _i31.OtpChallengeEntity challenge;

  final _i32.OtpPurpose purpose;

  final _i27.SignupDraft? draft;

  final String? phone;

  @override
  String toString() {
    return 'OtpRouteArgs{key: $key, challenge: $challenge, purpose: $purpose, draft: $draft, phone: $phone}';
  }
}

/// generated route for
/// [_i17.PersonalQuestionnairePage]
class PersonalQuestionnaireRoute
    extends _i25.PageRouteInfo<PersonalQuestionnaireRouteArgs> {
  PersonalQuestionnaireRoute({
    _i26.Key? key,
    String? programNameKey,
    String? incomeType,
    List<_i25.PageRouteInfo>? children,
  }) : super(
         PersonalQuestionnaireRoute.name,
         args: PersonalQuestionnaireRouteArgs(
           key: key,
           programNameKey: programNameKey,
           incomeType: incomeType,
         ),
         initialChildren: children,
       );

  static const String name = 'PersonalQuestionnaireRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<PersonalQuestionnaireRouteArgs>(
        orElse: () => const PersonalQuestionnaireRouteArgs(),
      );
      return _i17.PersonalQuestionnairePage(
        key: args.key,
        programNameKey: args.programNameKey,
        incomeType: args.incomeType,
      );
    },
  );
}

class PersonalQuestionnaireRouteArgs {
  const PersonalQuestionnaireRouteArgs({
    this.key,
    this.programNameKey,
    this.incomeType,
  });

  final _i26.Key? key;

  final String? programNameKey;

  final String? incomeType;

  @override
  String toString() {
    return 'PersonalQuestionnaireRouteArgs{key: $key, programNameKey: $programNameKey, incomeType: $incomeType}';
  }
}

/// generated route for
/// [_i18.PhoneVerificationPage]
class PhoneVerificationRoute
    extends _i25.PageRouteInfo<PhoneVerificationRouteArgs> {
  PhoneVerificationRoute({
    _i26.Key? key,
    String? pendingMobile,
    List<_i25.PageRouteInfo>? children,
  }) : super(
         PhoneVerificationRoute.name,
         args: PhoneVerificationRouteArgs(
           key: key,
           pendingMobile: pendingMobile,
         ),
         initialChildren: children,
       );

  static const String name = 'PhoneVerificationRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<PhoneVerificationRouteArgs>(
        orElse: () => const PhoneVerificationRouteArgs(),
      );
      return _i18.PhoneVerificationPage(
        key: args.key,
        pendingMobile: args.pendingMobile,
      );
    },
  );
}

class PhoneVerificationRouteArgs {
  const PhoneVerificationRouteArgs({this.key, this.pendingMobile});

  final _i26.Key? key;

  final String? pendingMobile;

  @override
  String toString() {
    return 'PhoneVerificationRouteArgs{key: $key, pendingMobile: $pendingMobile}';
  }
}

/// generated route for
/// [_i19.PreviousApplicationsPage]
class PreviousApplicationsRoute extends _i25.PageRouteInfo<void> {
  const PreviousApplicationsRoute({List<_i25.PageRouteInfo>? children})
    : super(PreviousApplicationsRoute.name, initialChildren: children);

  static const String name = 'PreviousApplicationsRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      return const _i19.PreviousApplicationsPage();
    },
  );
}

/// generated route for
/// [_i20.ProfileEditContactPage]
class ProfileEditContactRoute
    extends _i25.PageRouteInfo<ProfileEditContactRouteArgs> {
  ProfileEditContactRoute({
    _i26.Key? key,
    required _i33.ProfileContactDraft initial,
    List<_i25.PageRouteInfo>? children,
  }) : super(
         ProfileEditContactRoute.name,
         args: ProfileEditContactRouteArgs(key: key, initial: initial),
         initialChildren: children,
       );

  static const String name = 'ProfileEditContactRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<ProfileEditContactRouteArgs>();
      return _i20.ProfileEditContactPage(key: args.key, initial: args.initial);
    },
  );
}

class ProfileEditContactRouteArgs {
  const ProfileEditContactRouteArgs({this.key, required this.initial});

  final _i26.Key? key;

  final _i33.ProfileContactDraft initial;

  @override
  String toString() {
    return 'ProfileEditContactRouteArgs{key: $key, initial: $initial}';
  }
}

/// generated route for
/// [_i20.ProfileEditPersonalPage]
class ProfileEditPersonalRoute
    extends _i25.PageRouteInfo<ProfileEditPersonalRouteArgs> {
  ProfileEditPersonalRoute({
    _i26.Key? key,
    required _i33.ProfilePersonalDraft initial,
    List<_i25.PageRouteInfo>? children,
  }) : super(
         ProfileEditPersonalRoute.name,
         args: ProfileEditPersonalRouteArgs(key: key, initial: initial),
         initialChildren: children,
       );

  static const String name = 'ProfileEditPersonalRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<ProfileEditPersonalRouteArgs>();
      return _i20.ProfileEditPersonalPage(key: args.key, initial: args.initial);
    },
  );
}

class ProfileEditPersonalRouteArgs {
  const ProfileEditPersonalRouteArgs({this.key, required this.initial});

  final _i26.Key? key;

  final _i33.ProfilePersonalDraft initial;

  @override
  String toString() {
    return 'ProfileEditPersonalRouteArgs{key: $key, initial: $initial}';
  }
}

/// generated route for
/// [_i20.ProfilePage]
class ProfileRoute extends _i25.PageRouteInfo<void> {
  const ProfileRoute({List<_i25.PageRouteInfo>? children})
    : super(ProfileRoute.name, initialChildren: children);

  static const String name = 'ProfileRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      return const _i20.ProfilePage();
    },
  );
}

/// generated route for
/// [_i21.SavedOffersPage]
class SavedOffersRoute extends _i25.PageRouteInfo<SavedOffersRouteArgs> {
  SavedOffersRoute({
    _i26.Key? key,
    bool fromTab = false,
    List<_i25.PageRouteInfo>? children,
  }) : super(
         SavedOffersRoute.name,
         args: SavedOffersRouteArgs(key: key, fromTab: fromTab),
         initialChildren: children,
       );

  static const String name = 'SavedOffersRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<SavedOffersRouteArgs>(
        orElse: () => const SavedOffersRouteArgs(),
      );
      return _i21.SavedOffersPage(key: args.key, fromTab: args.fromTab);
    },
  );
}

class SavedOffersRouteArgs {
  const SavedOffersRouteArgs({this.key, this.fromTab = false});

  final _i26.Key? key;

  final bool fromTab;

  @override
  String toString() {
    return 'SavedOffersRouteArgs{key: $key, fromTab: $fromTab}';
  }
}

/// generated route for
/// [_i22.SettingsSecurityPage]
class SettingsSecurityRoute extends _i25.PageRouteInfo<void> {
  const SettingsSecurityRoute({List<_i25.PageRouteInfo>? children})
    : super(SettingsSecurityRoute.name, initialChildren: children);

  static const String name = 'SettingsSecurityRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      return const _i22.SettingsSecurityPage();
    },
  );
}

/// generated route for
/// [_i23.SignupPage]
class SignupRoute extends _i25.PageRouteInfo<void> {
  const SignupRoute({List<_i25.PageRouteInfo>? children})
    : super(SignupRoute.name, initialChildren: children);

  static const String name = 'SignupRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      return const _i23.SignupPage();
    },
  );
}

/// generated route for
/// [_i24.SplashPage]
class SplashRoute extends _i25.PageRouteInfo<void> {
  const SplashRoute({List<_i25.PageRouteInfo>? children})
    : super(SplashRoute.name, initialChildren: children);

  static const String name = 'SplashRoute';

  static _i25.PageInfo page = _i25.PageInfo(
    name,
    builder: (data) {
      return const _i24.SplashPage();
    },
  );
}
