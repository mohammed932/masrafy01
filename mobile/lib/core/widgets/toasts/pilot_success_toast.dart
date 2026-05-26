import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/utils/pilot_assets.dart';
import 'package:app/core/widgets/toasts/pilot_toast.dart';

/// Green success toast — used after a successful save / mutation that
/// the user should be acknowledged for ("Flag updated", "Comment posted").
class PilotSuccessToast extends PilotToast {
  const PilotSuccessToast({required super.message, super.duration});

  @override
  String get iconAsset => PilotAssets.kNotifCheckMark;

  @override
  Color backgroundColor(PilotColorTheme colors) => colors.success.main;
}
