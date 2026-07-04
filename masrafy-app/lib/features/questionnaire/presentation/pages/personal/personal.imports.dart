import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import 'package:app/core/di/injection.dart';
import 'package:app/core/router/router.gr.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/widgets/buttons/masrafy_gradient_button.dart';
import 'package:app/features/offers/presentation/models/match_results_args.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import 'cubit/personal_questionnaire/personal_questionnaire_cubit.dart';
import 'personal_apply_mapper.dart';
import 'widgets/personal_step_commitments.dart';
import 'widgets/personal_step_employment.dart';
import 'widgets/personal_step_financing.dart';
import 'widgets/personal_step_preferences.dart';

part 'personal_questionnaire_page.dart';
