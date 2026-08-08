import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/di/injection.dart';
import 'package:app/core/router/router.gr.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/router/main_tab_navigator.dart';
import 'package:app/core/widgets/common/masrafy_app_bottom_nav.dart';
import 'package:app/core/widgets/common/masrafy_shell_nav_bar.dart';
import 'package:app/core/widgets/common/masrafy_back_title_header.dart';
import 'package:app/core/widgets/common/masrafy_empty_state.dart';
import 'package:app/core/widgets/common/masrafy_toast.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer_box.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import 'package:app/features/offers/presentation/models/match_results_args.dart';
import 'package:app/features/saved_offers/domain/entities/saved_offer_entity.dart';
import 'cubit/saved_offers/saved_offers_cubit.dart';
import 'widgets/saved_offer_card.dart';

part 'saved_offers_page.dart';
