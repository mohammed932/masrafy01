import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/pilot_color_brand.dart';
import 'package:app/core/theme/colors/pilot_color_neutral.dart';
import 'package:app/core/theme/colors/pilot_color_palette.dart';
import 'package:app/core/theme/colors/pilot_dark_theme.dart';
import 'package:app/core/theme/colors/pilot_light_theme.dart';

export 'package:app/core/theme/colors/pilot_color_brand.dart';
export 'package:app/core/theme/colors/pilot_color_neutral.dart';
export 'package:app/core/theme/colors/pilot_color_palette.dart';
export 'package:app/core/theme/colors/pilot_dark_theme.dart';
export 'package:app/core/theme/colors/pilot_light_theme.dart';

/// UserEntity-facing theme mode. `system` follows the OS setting at runtime.
enum ColorThemes { light, dark, system }

enum ThemeColorEnum { pilotLightTheme, pilotDarkTheme }

/// Abstract base for the Masrafy color system.
///
/// Two concrete implementations: [PilotLightTheme] and [PilotDarkTheme].
/// Resolved in the widget tree via [PilotColorThemeProvider] and read with
/// `PilotColorTheme.of(context)`.
abstract class PilotColorTheme extends Equatable {
  const PilotColorTheme();

  // Identity
  ThemeColorEnum get id;
  Brightness get brightness;

  // Nested token groups
  PilotColorPalette get palette;
  PilotTextColors get text;
  PilotIconColors get icon;
  PilotBgColors get bg;
  PilotBorderColors get border;
  PilotFillColors get fill;
  PilotBrandTone get primary;
  PilotBrandTone get success;
  PilotBrandTone get warning;
  PilotBrandTone get info;
  PilotBrandTone get error;
  PilotLinkColors get link;
  PilotControlColors get control;
  PilotMedalColors get medal;
  PilotCrownColors get crown;
  PilotChartColors get chart;

  // Top-level tokens
  Color get white;
  Color get bgBase;
  Color get textBase;

  PilotColorTheme copyWith();

  @override
  List<Object?> get props => [id];

  /// Read the currently active theme from the widget tree.
  ///
  /// Falls back to [PilotLightTheme] if no [PilotColorThemeProvider] is found.
  static PilotColorTheme of(BuildContext context) {
    final provider = context
        .dependOnInheritedWidgetOfExactType<PilotColorThemeProvider>();
    return provider?.theme ?? const PilotLightTheme();
  }

  /// Resolve the concrete theme for a user-selected [mode] and the current
  /// platform [brightness]. `system` picks light or dark based on the OS.
  static PilotColorTheme resolve(ColorThemes mode, Brightness brightness) {
    return switch (mode) {
      ColorThemes.light => const PilotLightTheme(),
      ColorThemes.dark => const PilotDarkTheme(),
      ColorThemes.system => brightness == Brightness.dark
          ? const PilotDarkTheme()
          : const PilotLightTheme(),
    };
  }
}

/// InheritedWidget that exposes the active [PilotColorTheme] to descendants.
/// Driven by `ThemeBloc`. Wrap the app shell inside the Bloc builder.
class PilotColorThemeProvider extends InheritedWidget {
  const PilotColorThemeProvider({
    super.key,
    required this.theme,
    required super.child,
  });

  final PilotColorTheme theme;

  @override
  bool updateShouldNotify(PilotColorThemeProvider oldWidget) =>
      theme != oldWidget.theme;
}
