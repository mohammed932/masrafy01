import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/di/injection.dart';
import 'package:app/core/features/id_capture/capture_national_id.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/widgets/buttons/masrafy_gradient_button.dart';
import 'package:app/core/widgets/common/masrafy_empty_state.dart';
import 'package:app/core/widgets/common/masrafy_gradient_header.dart';
import 'package:app/core/widgets/common/masrafy_toast.dart';
import 'package:app/core/widgets/input_controls/masrafy_national_id_uploader.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer_box.dart';
import 'package:app/core/widgets/slivers/masrafy_sliver_gradient_header_delegate.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import 'cubit/apply_documents/apply_documents_cubit.dart';

part 'apply_documents_page.dart';
