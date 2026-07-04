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

import 'cubit/business_questionnaire/business_questionnaire_cubit.dart';
import 'business_apply_mapper.dart';
import 'widgets/business_step_financial.dart';
import 'widgets/business_step_financing.dart';
import 'widgets/business_step_obligations.dart';
import 'widgets/business_step_preferences.dart';

part 'business_questionnaire_page.dart';
