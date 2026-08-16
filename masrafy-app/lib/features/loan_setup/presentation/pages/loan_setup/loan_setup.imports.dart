import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/di/injection.dart';
import 'package:app/core/router/router.gr.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/buttons/masrafy_gradient_button.dart';
import 'package:app/features/questionnaire/domain/enums/loan_category.dart';
import 'package:app/l10n/generated/app_localizations.dart';
import 'cubit/loan_setup/loan_setup_cubit.dart';
import 'loan_setup_shimmer.dart';
import 'widgets/loan_setup_category_step.dart';
import 'widgets/loan_setup_income_step.dart';
import 'widgets/loan_setup_program_step.dart';

part 'loan_setup_page.dart';
