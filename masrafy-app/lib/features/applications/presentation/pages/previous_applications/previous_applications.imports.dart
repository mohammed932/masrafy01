import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/di/injection.dart';
import 'package:app/core/router/router.gr.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/widgets/common/masrafy_app_bottom_nav.dart';
import 'package:app/core/widgets/common/masrafy_back_title_header.dart';
import 'package:app/core/widgets/common/masrafy_empty_state.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer_box.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import 'cubit/previous_applications/previous_applications_cubit.dart';
import 'widgets/past_application_card.dart';

part 'previous_applications_page.dart';
