// dart format width=80
// GENERATED CODE - DO NOT MODIFY BY HAND

// **************************************************************************
// AutoRouterGenerator
// **************************************************************************

// ignore_for_file: type=lint
// coverage:ignore-file

// ignore_for_file: no_leading_underscores_for_library_prefixes
import 'package:app/features/auth/presentation/pages/complete_profile/complete_profile.imports.dart'
    as _i1;
import 'package:app/features/auth/presentation/pages/forgot_password/forgot_password.imports.dart'
    as _i2;
import 'package:app/features/auth/presentation/pages/landing/landing.imports.dart'
    as _i3;
import 'package:app/features/auth/presentation/pages/login/login.imports.dart'
    as _i4;
import 'package:app/features/auth/presentation/pages/phone_signup/phone_signup.imports.dart'
    as _i5;
import 'package:auto_route/auto_route.dart' as _i6;
import 'package:flutter/material.dart' as _i7;

/// generated route for
/// [_i1.CompleteProfilePage]
class CompleteProfileRoute extends _i6.PageRouteInfo<void> {
  const CompleteProfileRoute({List<_i6.PageRouteInfo>? children})
    : super(CompleteProfileRoute.name, initialChildren: children);

  static const String name = 'CompleteProfileRoute';

  static _i6.PageInfo page = _i6.PageInfo(
    name,
    builder: (data) {
      return const _i1.CompleteProfilePage();
    },
  );
}

/// generated route for
/// [_i2.ForgotPasswordPage]
class ForgotPasswordRoute extends _i6.PageRouteInfo<void> {
  const ForgotPasswordRoute({List<_i6.PageRouteInfo>? children})
    : super(ForgotPasswordRoute.name, initialChildren: children);

  static const String name = 'ForgotPasswordRoute';

  static _i6.PageInfo page = _i6.PageInfo(
    name,
    builder: (data) {
      return const _i2.ForgotPasswordPage();
    },
  );
}

/// generated route for
/// [_i3.LandingPage]
class LandingRoute extends _i6.PageRouteInfo<void> {
  const LandingRoute({List<_i6.PageRouteInfo>? children})
    : super(LandingRoute.name, initialChildren: children);

  static const String name = 'LandingRoute';

  static _i6.PageInfo page = _i6.PageInfo(
    name,
    builder: (data) {
      return const _i3.LandingPage();
    },
  );
}

/// generated route for
/// [_i4.LoginPage]
class LoginRoute extends _i6.PageRouteInfo<LoginRouteArgs> {
  LoginRoute({
    _i7.Key? key,
    String? initialPhone,
    List<_i6.PageRouteInfo>? children,
  }) : super(
         LoginRoute.name,
         args: LoginRouteArgs(key: key, initialPhone: initialPhone),
         initialChildren: children,
       );

  static const String name = 'LoginRoute';

  static _i6.PageInfo page = _i6.PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<LoginRouteArgs>(
        orElse: () => const LoginRouteArgs(),
      );
      return _i4.LoginPage(key: args.key, initialPhone: args.initialPhone);
    },
  );
}

class LoginRouteArgs {
  const LoginRouteArgs({this.key, this.initialPhone});

  final _i7.Key? key;

  final String? initialPhone;

  @override
  String toString() {
    return 'LoginRouteArgs{key: $key, initialPhone: $initialPhone}';
  }
}

/// generated route for
/// [_i5.PhoneSignupPage]
class PhoneSignupRoute extends _i6.PageRouteInfo<void> {
  const PhoneSignupRoute({List<_i6.PageRouteInfo>? children})
    : super(PhoneSignupRoute.name, initialChildren: children);

  static const String name = 'PhoneSignupRoute';

  static _i6.PageInfo page = _i6.PageInfo(
    name,
    builder: (data) {
      return const _i5.PhoneSignupPage();
    },
  );
}
