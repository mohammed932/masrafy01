import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:intl/intl.dart';

import 'package:app/core/di/injection.dart';
import 'package:app/core/router/router.gr.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/widgets/common/masrafy_empty_state.dart';
import 'package:app/core/widgets/common/masrafy_gradient_header.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer_box.dart';
import 'package:app/core/widgets/slivers/masrafy_sliver_gradient_header_delegate.dart';
import 'package:app/core/widgets/steppers/masrafy_segmented_progress.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../../models/match_results_args.dart';
import '../widgets/match_summary_card.dart';
import 'cubit/matching_results/matching_results_cubit.dart';
import 'widgets/match_offer_card.dart';

part 'match_results_page.dart';
