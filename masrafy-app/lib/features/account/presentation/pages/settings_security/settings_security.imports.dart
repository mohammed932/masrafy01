import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/di/injection.dart';
import 'package:app/core/locale/locale_cubit/locale_cubit.dart';
import 'package:app/core/router/router.gr.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/widgets/common/masrafy_app_bottom_nav.dart';
import 'package:app/core/widgets/common/masrafy_shell_nav_bar.dart';
import 'package:app/core/widgets/common/masrafy_back_title_header.dart';
import 'package:app/core/widgets/common/masrafy_toast.dart';
import 'package:app/core/widgets/input_controls/masrafy_single_select_sheet.dart';
import 'package:app/core/widgets/input_controls/masrafy_switch.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import 'cubit/settings_security/settings_security_cubit.dart';
import 'widgets/settings_section.dart';
import 'widgets/settings_tile.dart';

part 'settings_security_page.dart';
