import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';

class PilotDarkTheme extends PilotColorTheme {
  const PilotDarkTheme();

  @override
  ThemeColorEnum get id => ThemeColorEnum.pilotDarkTheme;

  @override
  Brightness get brightness => Brightness.dark;

  @override
  PilotColorPalette get palette => PilotColorPalette.dark;

  @override
  PilotTextColors get text => PilotTextColors.dark;

  @override
  PilotIconColors get icon => PilotIconColors.dark;

  @override
  PilotBgColors get bg => PilotBgColors.dark;

  @override
  PilotBorderColors get border => PilotBorderColors.dark;

  @override
  PilotFillColors get fill => PilotFillColors.dark;

  @override
  PilotBrandTone get primary => pilotPrimaryDark;

  @override
  PilotBrandTone get success => pilotSuccessDark;

  @override
  PilotBrandTone get warning => pilotWarningDark;

  @override
  PilotBrandTone get info => pilotInfoDark;

  @override
  PilotBrandTone get error => pilotErrorDark;

  @override
  PilotLinkColors get link => pilotLinkDark;

  @override
  PilotControlColors get control => pilotControlDark;

  @override
  PilotMedalColors get medal => pilotMedalDark;

  @override
  PilotCrownColors get crown => pilotCrownDark;

  @override
  PilotChartColors get chart => pilotChartDark;

  @override
  Color get white => const Color(0xFFFFFFFF);

  @override
  Color get bgBase => const Color(0xFF000000);

  @override
  Color get textBase => const Color(0xFFFFFFFF);

  @override
  PilotDarkTheme copyWith() => const PilotDarkTheme();
}
