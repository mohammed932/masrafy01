import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/utils/pilot_assets.dart';
import 'package:app/core/widgets/toasts/pilot_toast.dart';

/// Red failure toast — used when a user-initiated action fails
/// (network error, server rejection) and state has been rolled back.
class PilotErrorToast extends PilotToast {
  const PilotErrorToast({required super.message, super.duration});

  @override
  String get iconAsset => PilotAssets.kNotifClose;

  @override
  Color backgroundColor(PilotColorTheme colors) => colors.error.main;
}
