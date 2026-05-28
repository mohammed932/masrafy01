// Placeholder per-flow library for the SOCIAL sign-in flow (feature 008) per
// Principle XXXII. NO page widget exists yet — the SOCIAL flow is currently
// driven entirely by the LandingPage CTAs invoking SocialSignInCubit directly.
//
// When a dedicated screen is introduced (e.g. provider-picker fallback or
// post-login spinner), add the page file under this folder, declare it as
// `part '<file>.dart';` below, and re-introduce the imports the flow needs:
//
//   import 'package:flutter/material.dart';
//   import 'package:flutter_bloc/flutter_bloc.dart';
//   import '../../../../../l10n/generated/app_localizations.dart';
//   import 'cubit/social_signin/social_signin_cubit.dart';
