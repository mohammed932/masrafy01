import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/utils/pilot_assets.dart';
import 'package:app/core/widgets/toasts/pilot_toast.dart';

/// Amber/yellow warning toast — used for validation errors or recoverable
/// issues the user should be aware of ("Please fill all required fields").
class PilotWarningToast extends PilotToast {
  const PilotWarningToast({required super.message, super.duration});

  @override
  String get iconAsset => PilotAssets.kNotifInfo;

  @override
  Color backgroundColor(PilotColorTheme colors) => colors.warning.main;
}