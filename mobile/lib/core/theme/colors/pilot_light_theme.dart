import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';

class PilotLightTheme extends PilotColorTheme {
  const PilotLightTheme();

  @override
  ThemeColorEnum get id => ThemeColorEnum.pilotLightTheme;

  @override
  Brightness get brightness => Brightness.light;

  @override
  PilotColorPalette get palette => PilotColorPalette.light;

  @override
  PilotTextColors get text => PilotTextColors.light;

  @override
  PilotIconColors get icon => PilotIconColors.light;

  @override
  PilotBgColors get bg => PilotBgColors.light;

  @override
  PilotBorderColors get border => PilotBorderColors.light;

  @override
  PilotFillColors get fill => PilotFillColors.light;

  @override
  PilotBrandTone get primary => pilotPrimaryLight;

  @override
  PilotBrandTone get success => pilotSuccessLight;

  @override
  PilotBrandTone get warning => pilotWarningLight;

  @override
  PilotBrandTone get info => pilotInfoLight;

  @override
  PilotBrandTone get error => pilotErrorLight;

  @override
  PilotLinkColors get link => pilotLinkLight;

  @override
  PilotControlColors get control => pilotControlLight;

  @override
  PilotMedalColors get medal => pilotMedalLight;

  @override
  PilotCrownColors get crown => pilotCrownLight;

  @override
  PilotChartColors get chart => pilotChartLight;

  @override
  Color get white => const Color(0xFFFFFFFF);

  @override
  Color get bgBase => const Color(0xFFFFFFFF);

  @override
  Color get textBase => const Color(0xFF000000);

  @override
  PilotLightTheme copyWith() => const PilotLightTheme();
}
