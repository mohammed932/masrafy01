import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';

class MasrafyLightTheme extends MasrafyColorTheme {
  const MasrafyLightTheme();

  @override
  ThemeColorEnum get id => ThemeColorEnum.masrafyLightTheme;

  @override
  Brightness get brightness => Brightness.light;

  @override
  MasrafyColorPalette get palette => MasrafyColorPalette.light;

  @override
  MasrafyTextColors get text => MasrafyTextColors.light;

  @override
  MasrafyIconColors get icon => MasrafyIconColors.light;

  @override
  MasrafyBgColors get bg => MasrafyBgColors.light;

  @override
  MasrafyBorderColors get border => MasrafyBorderColors.light;

  @override
  MasrafyFillColors get fill => MasrafyFillColors.light;

  @override
  MasrafyBrandTone get primary => masrafyPrimaryLight;

  @override
  MasrafyBrandTone get secondary => masrafySecondaryLight;

  @override
  MasrafyBrandTone get success => masrafySuccessLight;

  @override
  MasrafyBrandTone get warning => masrafyWarningLight;

  @override
  MasrafyBrandTone get info => masrafyInfoLight;

  @override
  MasrafyBrandTone get error => masrafyErrorLight;

  @override
  MasrafyLinkColors get link => masrafyLinkLight;

  @override
  MasrafyControlColors get control => masrafyControlLight;

  @override
  MasrafyMedalColors get medal => masrafyMedalLight;

  @override
  MasrafyCrownColors get crown => masrafyCrownLight;

  @override
  MasrafyChartColors get chart => masrafyChartLight;

  @override
  Color get white => const Color(0xFFFFFFFF);

  // Ghost White (Light) base; text on Midnight Navy (Neutral).
  @override
  Color get bgBase => const Color(0xFFFFFFFF);

  @override
  Color get textBase => const Color(0xFF021331);

  @override
  MasrafyLightTheme copyWith() => const MasrafyLightTheme();
}
