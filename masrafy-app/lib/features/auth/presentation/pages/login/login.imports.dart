import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/di/injection.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/core/router/router.gr.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/buttons/masrafy_gradient_button.dart';
import 'package:app/core/widgets/buttons/masrafy_social_button.dart';
import 'package:app/core/widgets/common/masrafy_gradient_header.dart';
import 'package:app/core/widgets/keyboard/masrafy_keyboard_inset.dart';
import 'package:app/core/widgets/slivers/masrafy_sliver_gradient_header_delegate.dart';
import 'package:app/core/widgets/common/masrafy_or_divider.dart';
import 'package:app/core/widgets/input_controls/masrafy_field_metrics.dart';
import 'package:app/core/widgets/common/masrafy_toast.dart';
import 'package:app/l10n/generated/app_localizations.dart';
import 'cubit/login/login_cubit.dart';

part 'login_page.dart';
