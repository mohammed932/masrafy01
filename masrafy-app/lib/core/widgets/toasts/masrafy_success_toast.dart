import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/utils/masrafy_assets.dart';
import 'package:app/core/widgets/toasts/masrafy_toast.dart';

/// Green success toast — used after a successful save / mutation that
/// the user should be acknowledged for ("Flag updated", "Comment posted").
class MasrafySuccessToast extends MasrafyToast {
  const MasrafySuccessToast({required super.message, super.duration});

  @override
  String get iconAsset => MasrafyAssets.kNotifCheckMark;

  @override
  Color backgroundColor(MasrafyColorTheme colors) => colors.success.main;
}
