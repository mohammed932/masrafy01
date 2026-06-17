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

import 'cubit/car_questionnaire/car_questionnaire_cubit.dart';
import 'widgets/car_step_employment.dart';
import 'widgets/car_step_financial.dart';
import 'widgets/car_step_preferences.dart';
import 'widgets/car_step_vehicle.dart';

part 'car_questionnaire_page.dart';
