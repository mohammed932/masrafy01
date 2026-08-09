import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:intl/intl.dart';

import 'package:app/core/di/injection.dart';
import 'package:app/core/features/platform_enumerations/domain/usecases/platform_enumerations_usecase.dart';
import 'package:app/core/router/router.gr.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/buttons/masrafy_gradient_button.dart';
import 'package:app/core/widgets/common/masrafy_gradient_header.dart';
import 'package:app/core/widgets/common/masrafy_toast.dart';
import 'package:app/core/widgets/dialogs/masrafy_documents_required_dialog.dart';
import 'package:app/core/widgets/slivers/masrafy_sliver_gradient_header_delegate.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../../models/match_results_args.dart';
import '../widgets/match_summary_card.dart';
import 'cubit/national_id_status/national_id_status_cubit.dart';
import 'cubit/save_offer/save_offer_cubit.dart';
import 'cubit/select_offer/select_offer_cubit.dart';
import 'widgets/offer_fees_card.dart';
import 'widgets/offer_stat_tile.dart';

part 'offer_details_page.dart';
part 'widgets/offer_required_documents_card.dart';
