import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/utils/masrafy_assets.dart';
import 'package:app/core/widgets/toasts/masrafy_toast.dart';

/// Amber/yellow warning toast — used for validation errors or recoverable
/// issues the user should be aware of ("Please fill all required fields").
class MasrafyWarningToast extends MasrafyToast {
  const MasrafyWarningToast({required super.message, super.duration});

  @override
  String get iconAsset => MasrafyAssets.kNotifInfo;

  @override
  Color backgroundColor(MasrafyColorTheme colors) => colors.warning.main;
}