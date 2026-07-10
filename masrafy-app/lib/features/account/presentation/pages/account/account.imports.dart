import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/di/injection.dart';
import 'package:app/core/router/router.gr.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/widgets/common/masrafy_app_bottom_nav.dart';
import 'package:app/core/widgets/common/masrafy_back_title_header.dart';
import 'package:app/core/widgets/common/masrafy_support_card.dart';
import 'package:app/core/widgets/common/masrafy_toast.dart';
import 'package:app/core/widgets/dialogs/masrafy_confirm_dialog.dart';
import 'package:app/features/auth/domain/usecases/auth_usecase.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import 'widgets/account_menu_tile.dart';

part 'account_page.dart';
