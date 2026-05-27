import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/masrafy_color_brand.dart';
import 'package:app/core/theme/colors/masrafy_color_neutral.dart';
import 'package:app/core/theme/colors/masrafy_color_palette.dart';
import 'package:app/core/theme/colors/masrafy_dark_theme.dart';
import 'package:app/core/theme/colors/masrafy_light_theme.dart';

export 'package:app/core/theme/colors/masrafy_color_brand.dart';
export 'package:app/core/theme/colors/masrafy_color_neutral.dart';
export 'package:app/core/theme/colors/masrafy_color_palette.dart';
export 'package:app/core/theme/colors/masrafy_dark_theme.dart';
export 'package:app/core/theme/colors/masrafy_light_theme.dart';

/// UserEntity-facing theme mode. `system` follows the OS setting at runtime.
enum ColorThemes { light, dark, system }

enum ThemeColorEnum { masrafyLightTheme, masrafyDarkTheme }

/// Abstract base for the Masrafy color system.
///
/// Two concrete implementations: [MasrafyLightTheme] and [MasrafyDarkTheme].
/// Resolved in the widget tree via [MasrafyColorThemeProvider] and read with
/// `MasrafyColorTheme.of(context)`.
abstract class MasrafyColorTheme extends Equatable {
  const MasrafyColorTheme();

  // Identity
  ThemeColorEnum get id;
  Brightness get brightness;

  // Nested token groups
  MasrafyColorPalette get palette;
  MasrafyTextColors get text;
  MasrafyIconColors get icon;
  MasrafyBgColors get bg;
  MasrafyBorderColors get border;
  MasrafyFillColors get fill;
  MasrafyBrandTone get primary;
  MasrafyBrandTone get success;
  MasrafyBrandTone get warning;
  MasrafyBrandTone get info;
  MasrafyBrandTone get error;
  MasrafyLinkColors get link;
  MasrafyControlColors get control;
  MasrafyMedalColors get medal;
  MasrafyCrownColors get crown;
  MasrafyChartColors get chart;

  // Top-level tokens
  Color get white;
  Color get bgBase;
  Color get textBase;

  MasrafyColorTheme copyWith();

  @override
  List<Object?> get props => [id];

  /// Read the currently active theme from the widget tree.
  ///
  /// Falls back to [MasrafyLightTheme] if no [MasrafyColorThemeProvider] is found.
  static MasrafyColorTheme of(BuildContext context) {
    final provider = context
        .dependOnInheritedWidgetOfExactType<MasrafyColorThemeProvider>();
    return provider?.theme ?? const MasrafyLightTheme();
  }

  /// Resolve the concrete theme for a user-selected [mode] and the current
  /// platform [brightness]. `system` picks light or dark based on the OS.
  static MasrafyColorTheme resolve(ColorThemes mode, Brightness brightness) {
    return switch (mode) {
      ColorThemes.light => const MasrafyLightTheme(),
      ColorThemes.dark => const MasrafyDarkTheme(),
      ColorThemes.system => brightness == Brightness.dark
          ? const MasrafyDarkTheme()
          : const MasrafyLightTheme(),
    };
  }
}

/// InheritedWidget that exposes the active [MasrafyColorTheme] to descendants.
/// Driven by `ThemeBloc`. Wrap the app shell inside the Bloc builder.
class MasrafyColorThemeProvider extends InheritedWidget {
  const MasrafyColorThemeProvider({
    super.key,
    required this.theme,
    required super.child,
  });

  final MasrafyColorTheme theme;

  @override
  bool updateShouldNotify(MasrafyColorThemeProvider oldWidget) =>
      theme != oldWidget.theme;
}
