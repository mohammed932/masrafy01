import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/utils/masrafy_assets.dart';
import 'package:app/core/widgets/toasts/masrafy_toast.dart';

/// Red failure toast — used when a user-initiated action fails
/// (network error, server rejection) and state has been rolled back.
class MasrafyErrorToast extends MasrafyToast {
  const MasrafyErrorToast({required super.message, super.duration});

  @override
  String get iconAsset => MasrafyAssets.kNotifClose;

  @override
  Color backgroundColor(MasrafyColorTheme colors) => colors.error.main;
}
