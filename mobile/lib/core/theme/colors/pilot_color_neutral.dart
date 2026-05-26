import 'package:flutter/material.dart';

class PilotTextColors {
  const PilotTextColors({
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

  static const light = PilotTextColors(
    primary: Color(0xE6000000),
    secondary: Color(0xA6000000),
    tertiary: Color(0x73000000),
    quaternary: Color(0x40000000),
    lightSolid: Color(0xFFFFFFFF),
    heading: Color(0xE6000000),
    label: Color(0xA6000000),
    description: Color(0x73000000),
    disabled: Color(0x40000000),
    placeholder: Color(0x40000000),
    solid: Color(0xFFFFFFFF),
  );

  static const dark = PilotTextColors(
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
    solid: Color(0xFF000000),
  );

  PilotTextColors lerp(PilotTextColors other, double t) {
    return PilotTextColors(
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

class PilotIconColors {
  const PilotIconColors({required this.main, required this.hover});

  final Color main;
  final Color hover;

  static const light = PilotIconColors(
    main: Color(0x73000000),
    hover: Color(0xE6000000),
  );

  static const dark = PilotIconColors(
    main: Color(0x73FFFFFF),
    hover: Color(0xD9FFFFFF),
  );

  PilotIconColors lerp(PilotIconColors other, double t) {
    return PilotIconColors(
      main: Color.lerp(main, other.main, t) ?? main,
      hover: Color.lerp(hover, other.hover, t) ?? hover,
    );
  }
}

class PilotBgColors {
  const PilotBgColors({
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

  static const light = PilotBgColors(
    container: Color(0xFFFFFFFF),
    elevated: Color(0xFFFFFFFF),
    layout: Color(0xFFF5F5F5),
    mask: Color(0x73000000),
    spotlight: Color(0xD9000000),
    containerDisabled: Color(0x0A000000),
    textActive: Color(0x26000000),
    textHover: Color(0x0F000000),
    borderBg: Color(0xFFFFFFFF),
    solid: Color(0xFF000000),
    solidActive: Color(0xF2000000),
    solidHover: Color(0xBF000000),
  );

  static const dark = PilotBgColors(
    container: Color(0xFF1F1F1F),
    elevated: Color(0xFF1F1F1F),
    layout: Color(0xFF000000),
    mask: Color(0x73000000),
    spotlight: Color(0xFF424242),
    containerDisabled: Color(0x14FFFFFF),
    textActive: Color(0x2EFFFFFF),
    textHover: Color(0x1FFFFFFF),
    borderBg: Color(0xFF1F1F1F),
    solid: Color(0xF2FFFFFF),
    solidActive: Color(0xE5FFFFFF),
    solidHover: Color(0xFFFFFFFF),
  );

  PilotBgColors lerp(PilotBgColors other, double t) {
    return PilotBgColors(
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

class PilotBorderColors {
  const PilotBorderColors({
    required this.main,
    required this.secondary,
    required this.split,
  });

  final Color main;
  final Color secondary;
  final Color split;

  static const light = PilotBorderColors(
    main: Color(0xFFD9D9D9),
    secondary: Color(0xFFF0F0F0),
    split: Color(0x0F000000),
  );

  static const dark = PilotBorderColors(
    main: Color(0xFF424242),
    secondary: Color(0xFF303030),
    split: Color(0x0FFFFFFF),
  );

  PilotBorderColors lerp(PilotBorderColors other, double t) {
    return PilotBorderColors(
      main: Color.lerp(main, other.main, t) ?? main,
      secondary: Color.lerp(secondary, other.secondary, t) ?? secondary,
      split: Color.lerp(split, other.split, t) ?? split,
    );
  }
}

class PilotFillColors {
  const PilotFillColors({
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

  static const light = PilotFillColors(
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

  static const dark = PilotFillColors(
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

  PilotFillColors lerp(PilotFillColors other, double t) {
    return PilotFillColors(
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
