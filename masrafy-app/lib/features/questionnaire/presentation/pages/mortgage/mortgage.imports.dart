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

import 'cubit/mortgage_questionnaire/mortgage_questionnaire_cubit.dart';
import 'mortgage_apply_mapper.dart';
import 'widgets/mortgage_step_credit.dart';
import 'widgets/mortgage_step_employment.dart';
import 'widgets/mortgage_step_preferences.dart';
import 'widgets/mortgage_step_property.dart';

part 'mortgage_questionnaire_page.dart';
