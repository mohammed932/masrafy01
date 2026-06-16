import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';

class MasrafyDarkTheme extends MasrafyColorTheme {
  const MasrafyDarkTheme();

  @override
  ThemeColorEnum get id => ThemeColorEnum.masrafyDarkTheme;

  @override
  Brightness get brightness => Brightness.dark;

  @override
  MasrafyColorPalette get palette => MasrafyColorPalette.dark;

  @override
  MasrafyTextColors get text => MasrafyTextColors.dark;

  @override
  MasrafyIconColors get icon => MasrafyIconColors.dark;

  @override
  MasrafyBgColors get bg => MasrafyBgColors.dark;

  @override
  MasrafyBorderColors get border => MasrafyBorderColors.dark;

  @override
  MasrafyFillColors get fill => MasrafyFillColors.dark;

  @override
  MasrafyBrandTone get primary => masrafyPrimaryDark;

  @override
  MasrafyBrandTone get secondary => masrafySecondaryDark;

  @override
  MasrafyBrandTone get success => masrafySuccessDark;

  @override
  MasrafyBrandTone get warning => masrafyWarningDark;

  @override
  MasrafyBrandTone get info => masrafyInfoDark;

  @override
  MasrafyBrandTone get error => masrafyErrorDark;

  @override
  MasrafyLinkColors get link => masrafyLinkDark;

  @override
  MasrafyControlColors get control => masrafyControlDark;

  @override
  MasrafyMedalColors get medal => masrafyMedalDark;

  @override
  MasrafyCrownColors get crown => masrafyCrownDark;

  @override
  MasrafyChartColors get chart => masrafyChartDark;

  @override
  Color get white => const Color(0xFFFFFFFF);

  // Midnight Navy (Dark) base; text on Ghost White.
  @override
  Color get bgBase => const Color(0xFF020F27);

  @override
  Color get textBase => const Color(0xFFFFFFFF);

  @override
  MasrafyDarkTheme copyWith() => const MasrafyDarkTheme();
}
