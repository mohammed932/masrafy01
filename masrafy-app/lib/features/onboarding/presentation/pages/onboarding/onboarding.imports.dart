import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/di/injection.dart';
import 'package:app/core/router/router.gr.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/utils/masrafy_assets.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/buttons/masrafy_gradient_button.dart';
import 'package:app/core/widgets/buttons/masrafy_secondary_button.dart';
import 'package:app/core/widgets/buttons/masrafy_social_button.dart';
import 'package:app/core/widgets/common/masrafy_or_divider.dart';
import 'package:app/core/widgets/common/masrafy_toast.dart';
import 'package:app/l10n/generated/app_localizations.dart';
import 'package:app/features/onboarding/presentation/models/onboarding_slide_data.dart';
import 'cubit/onboarding/onboarding_cubit.dart';
import 'widgets/onboarding_slide.dart';

part 'onboarding_page.dart';
