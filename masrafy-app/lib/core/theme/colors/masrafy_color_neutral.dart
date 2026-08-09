import 'package:flutter/material.dart';

class MasrafyTextColors {
  const MasrafyTextColors({
    required this.primary,
    required this.secondary,
    required this.tertiary,
    required this.quaternary,
    required this.lightSolid,
    required this.heading,
    required this.label,
    required this.description,
    required this.disabled,
    required this.placeholder,
    required this.solid,
  });

  final Color primary;
  final Color secondary;
  final Color tertiary;
  final Color quaternary;
  final Color lightSolid;
  final Color heading;
  final Color label;
  final Color description;
  final Color disabled;
  final Color placeholder;
  final Color solid;

  // Light: alpha steps over Midnight Navy (#021331) instead of pure black.
  static const light = MasrafyTextColors(
    primary: Color(0xE6021331),
    secondary: Color(0xA6021331),
    tertiary: Color(0x73021331),
    quaternary: Color(0x40021331),
    lightSolid: Color(0xFFFFFFFF),
    heading: Color(0xE6021331),
    label: Color(0xA6021331),
    description: Color(0x73021331),
    disabled: Color(0x40021331),
    placeholder: Color(0x40021331),
    solid: Color(0xFFFFFFFF),
  );

  static const dark = MasrafyTextColors(
    primary: Color(0xD9FFFFFF),
    secondary: Color(0xA6FFFFFF),
    tertiary: Color(0x73FFFFFF),
    quaternary: Color(0x40FFFFFF),
    lightSolid: Color(0xFFFFFFFF),
    heading: Color(0xD9FFFFFF),
    label: Color(0xA6FFFFFF),
    description: Color(0x73FFFFFF),
    disabled: Color(0x40FFFFFF),
    placeholder: Color(0x40FFFFFF),
    solid: Color(0xFF021331),
  );

  MasrafyTextColors lerp(MasrafyTextColors other, double t) {
    return MasrafyTextColors(
      primary: Color.lerp(primary, other.primary, t) ?? primary,
      secondary: Color.lerp(secondary, other.secondary, t) ?? secondary,
      tertiary: Color.lerp(tertiary, other.tertiary, t) ?? tertiary,
      quaternary: Color.lerp(quaternary, other.quaternary, t) ?? quaternary,
      lightSolid: Color.lerp(lightSolid, other.lightSolid, t) ?? lightSolid,
      heading: Color.lerp(heading, other.heading, t) ?? heading,
      label: Color.lerp(label, other.label, t) ?? label,
      description: Color.lerp(description, other.description, t) ?? description,
      disabled: Color.lerp(disabled, other.disabled, t) ?? disabled,
      placeholder: Color.lerp(placeholder, other.placeholder, t) ?? placeholder,
      solid: Color.lerp(solid, other.solid, t) ?? solid,
    );
  }
}

class MasrafyIconColors {
  const MasrafyIconColors({required this.main, required this.hover});

  final Color main;
  final Color hover;

  static const light = MasrafyIconColors(
    main: Color(0x73021331),
    hover: Color(0xE6021331),
  );

  static const dark = MasrafyIconColors(
    main: Color(0x73FFFFFF),
    hover: Color(0xD9FFFFFF),
  );

  MasrafyIconColors lerp(MasrafyIconColors other, double t) {
    return MasrafyIconColors(
      main: Color.lerp(main, other.main, t) ?? main,
      hover: Color.lerp(hover, other.hover, t) ?? hover,
    );
  }
}

class MasrafyBgColors {
  const MasrafyBgColors({
    required this.container,
    required this.elevated,
    required this.layout,
    required this.mask,
    required this.spotlight,
    required this.containerDisabled,
    required this.textActive,
    required this.textHover,
    required this.borderBg,
    required this.solid,
    required this.solidActive,
    required this.solidHover,
  });

  final Color container;
  final Color elevated;
  final Color layout;
  final Color mask;
  final Color spotlight;
  final Color containerDisabled;
  final Color textActive;
  final Color textHover;
  final Color borderBg;
  final Color solid;
  final Color solidActive;
  final Color solidHover;

  // Light: white containers on a Ghost White (Neutral #E7ECF6) layout.
  static const light = MasrafyBgColors(
    container: Color(0xFFFFFFFF),
    elevated: Color(0xFFFFFFFF),
    layout: Color(0xFFE7ECF6),
    mask: Color(0x73021331),
    spotlight: Color(0xD9021331),
    containerDisabled: Color(0x0A021331),
    textActive: Color(0x26021331),
    textHover: Color(0x0F021331),
    borderBg: Color(0xFFFFFFFF),
    solid: Color(0xFF021331),
    solidActive: Color(0xF2021331),
    solidHover: Color(0xBF021331),
  );

  // Dark: Midnight Navy surfaces (Neutral container, Dark layout, lifted
  // elevated).
  static const dark = MasrafyBgColors(
    container: Color(0xFF021331),
    elevated: Color(0xFF0A1A3A),
    layout: Color(0xFF020F27),
    mask: Color(0x73000000),
    spotlight: Color(0xFF14233F),
    containerDisabled: Color(0x14FFFFFF),
    textActive: Color(0x2EFFFFFF),
    textHover: Color(0x1FFFFFFF),
    borderBg: Color(0xFF021331),
    solid: Color(0xF2FFFFFF),
    solidActive: Color(0xE5FFFFFF),
    solidHover: Color(0xFFFFFFFF),
  );

  MasrafyBgColors lerp(MasrafyBgColors other, double t) {
    return MasrafyBgColors(
      container: Color.lerp(container, other.container, t) ?? container,
      elevated: Color.lerp(elevated, other.elevated, t) ?? elevated,
      layout: Color.lerp(layout, other.layout, t) ?? layout,
      mask: Color.lerp(mask, other.mask, t) ?? mask,
      spotlight: Color.lerp(spotlight, other.spotlight, t) ?? spotlight,
      containerDisabled:
          Color.lerp(containerDisabled, other.containerDisabled, t) ??
              containerDisabled,
      textActive: Color.lerp(textActive, other.textActive, t) ?? textActive,
      textHover: Color.lerp(textHover, other.textHover, t) ?? textHover,
      borderBg: Color.lerp(borderBg, other.borderBg, t) ?? borderBg,
      solid: Color.lerp(solid, other.solid, t) ?? solid,
      solidActive: Color.lerp(solidActive, other.solidActive, t) ?? solidActive,
      solidHover: Color.lerp(solidHover, other.solidHover, t) ?? solidHover,
    );
  }
}

class MasrafyBorderColors {
  const MasrafyBorderColors({
    required this.main,
    required this.secondary,
    required this.split,
    required this.field,
  });

  final Color main;
  final Color secondary;
  final Color split;

  /// Outline of an **interactive form control** (text input, select, DOB, phone,
  /// search) — deliberately darker than [main].
  ///
  /// [main] is a divider/card tone: at `#D5DBEC` on the `#E7ECF6` layout it
  /// contrasts 1.17:1, which is invisible as the only thing carrying a
  /// transparent field's box, so a control needs its own tone to out-read the
  /// furniture around it.
  ///
  /// Softened for eye comfort: a full form of 3:1 outlines reads as a wall of
  /// hard boxes. This tone sits at ≈ 1.7:1 on the light layout (`#E7ECF6`),
  /// ≈ 2.0:1 on white containers and ≈ 1.7:1 over dark `#021331` — below the
  /// WCAG 1.4.11 3:1 bar for a control boundary, which is accepted here
  /// deliberately. Focus and error states (which DO carry meaning) keep their
  /// full-strength brand / danger colours, so the low-contrast tone only ever
  /// carries the resting outline.
  final Color field;

  // Light: indigo-tinted neutrals (Ghost White Neutral as the soft divider).
  static const light = MasrafyBorderColors(
    main: Color(0xFFD5DBEC),
    secondary: Color(0xFFE7ECF6),
    split: Color(0x0F021331),
    field: Color(0xFFB0B9D4),
  );

  // Dark: navy-tinted dividers.
  static const dark = MasrafyBorderColors(
    main: Color(0xFF2A3556),
    secondary: Color(0xFF1A2540),
    split: Color(0x0FFFFFFF),
    field: Color(0xFF333B5C),
  );

  MasrafyBorderColors lerp(MasrafyBorderColors other, double t) {
    return MasrafyBorderColors(
      main: Color.lerp(main, other.main, t) ?? main,
      secondary: Color.lerp(secondary, other.secondary, t) ?? secondary,
      split: Color.lerp(split, other.split, t) ?? split,
      field: Color.lerp(field, other.field, t) ?? field,
    );
  }
}

class MasrafyFillColors {
  const MasrafyFillColors({
    required this.main,
    required this.secondary,
    required this.tertiary,
    required this.quaternary,
    required this.content,
    required this.contentHover,
    required this.alter,
    required this.alterSolid,
    required this.handleBg,
  });

  final Color main;
  final Color secondary;
  final Color tertiary;
  final Color quaternary;
  final Color content;
  final Color contentHover;
  final Color alter;
  final Color alterSolid;
  final Color handleBg;

  static const light = MasrafyFillColors(
    main: Color(0x26000000),
    secondary: Color(0x0F000000),
    tertiary: Color(0x0A000000),
    quaternary: Color(0x05000000),
    content: Color(0x0F000000),
    contentHover: Color(0x26000000),
    alter: Color(0x05000000),
    alterSolid: Color(0xFFFAFAFA),
    handleBg: Color(0xFFF0F0F0),
  );

  static const dark = MasrafyFillColors(
    main: Color(0x2EFFFFFF),
    secondary: Color(0x1FFFFFFF),
    tertiary: Color(0x14FFFFFF),
    quaternary: Color(0x0AFFFFFF),
    content: Color(0x1FFFFFFF),
    contentHover: Color(0x2EFFFFFF),
    alter: Color(0x0AFFFFFF),
    alterSolid: Color(0xFF1D1D1D),
    handleBg: Color(0xFF303030),
  );

  MasrafyFillColors lerp(MasrafyFillColors other, double t) {
    return MasrafyFillColors(
      main: Color.lerp(main, other.main, t) ?? main,
      secondary: Color.lerp(secondary, other.secondary, t) ?? secondary,
      tertiary: Color.lerp(tertiary, other.tertiary, t) ?? tertiary,
      quaternary: Color.lerp(quaternary, other.quaternary, t) ?? quaternary,
      content: Color.lerp(content, other.content, t) ?? content,
      contentHover: Color.lerp(contentHover, other.contentHover, t) ?? contentHover,
      alter: Color.lerp(alter, other.alter, t) ?? alter,
      alterSolid: Color.lerp(alterSolid, other.alterSolid, t) ?? alterSolid,
      handleBg: Color.lerp(handleBg, other.handleBg, t) ?? handleBg,
    );
  }
}
