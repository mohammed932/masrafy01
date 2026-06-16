import 'package:flutter/material.dart';

class MasrafyBrandTone {
  const MasrafyBrandTone({
    required this.main,
    required this.bg,
    required this.bgHover,
    required this.border,
    required this.borderHover,
    required this.hover,
    required this.active,
    required this.text,
    required this.textHover,
    required this.textActive,
    this.outline,
  });

  final Color main;
  final Color bg;
  final Color bgHover;
  final Color border;
  final Color borderHover;
  final Color hover;
  final Color active;
  final Color text;
  final Color textHover;
  final Color textActive;
  final Color? outline;

  MasrafyBrandTone lerp(MasrafyBrandTone other, double t) {
    return MasrafyBrandTone(
      main: Color.lerp(main, other.main, t) ?? main,
      bg: Color.lerp(bg, other.bg, t) ?? bg,
      bgHover: Color.lerp(bgHover, other.bgHover, t) ?? bgHover,
      border: Color.lerp(border, other.border, t) ?? border,
      borderHover: Color.lerp(borderHover, other.borderHover, t) ?? borderHover,
      hover: Color.lerp(hover, other.hover, t) ?? hover,
      active: Color.lerp(active, other.active, t) ?? active,
      text: Color.lerp(text, other.text, t) ?? text,
      textHover: Color.lerp(textHover, other.textHover, t) ?? textHover,
      textActive: Color.lerp(textActive, other.textActive, t) ?? textActive,
      outline: Color.lerp(outline, other.outline, t),
    );
  }
}

class MasrafyLinkColors {
  const MasrafyLinkColors({
    required this.main,
    required this.hover,
    required this.active,
  });

  final Color main;
  final Color hover;
  final Color active;

  MasrafyLinkColors lerp(MasrafyLinkColors other, double t) {
    return MasrafyLinkColors(
      main: Color.lerp(main, other.main, t) ?? main,
      hover: Color.lerp(hover, other.hover, t) ?? hover,
      active: Color.lerp(active, other.active, t) ?? active,
    );
  }
}

class MasrafyControlColors {
  const MasrafyControlColors({
    required this.itemBgActive,
    required this.itemBgActiveDisabled,
    required this.itemBgActiveHover,
    required this.itemBgHover,
    required this.outline,
    required this.tmpOutline,
  });

  final Color itemBgActive;
  final Color itemBgActiveDisabled;
  final Color itemBgActiveHover;
  final Color itemBgHover;
  final Color outline;
  final Color tmpOutline;

  MasrafyControlColors lerp(MasrafyControlColors other, double t) {
    return MasrafyControlColors(
      itemBgActive: Color.lerp(itemBgActive, other.itemBgActive, t) ?? itemBgActive,
      itemBgActiveDisabled:
          Color.lerp(itemBgActiveDisabled, other.itemBgActiveDisabled, t) ??
              itemBgActiveDisabled,
      itemBgActiveHover:
          Color.lerp(itemBgActiveHover, other.itemBgActiveHover, t) ??
              itemBgActiveHover,
      itemBgHover: Color.lerp(itemBgHover, other.itemBgHover, t) ?? itemBgHover,
      outline: Color.lerp(outline, other.outline, t) ?? outline,
      tmpOutline: Color.lerp(tmpOutline, other.tmpOutline, t) ?? tmpOutline,
    );
  }
}

// ---------------------------------------------------------------------------
// Brand tones — sourced from the Masrafy Figma "Mode 1" tokens.
//   Primary   = Figma Primary indigo   (Light #4D57A8 / Neutral #283382 /
//               Dark #1B2776; border = Support "Wisteria Blue" #8099CB).
//   Secondary = Figma Secondary blue   (Light #3990FF / Neutral #0082F8 /
//               Dark #005DB5; border = Support "Blue Ice" #A6CEFF).
// `main`/`text` = Neutral, `hover` = Light, `active` = Dark in light mode.
// Dark mode brightens (`main` = Light, `active` = Neutral) and mixes surface
// tints toward Midnight Navy (#021331). bg/bgHover tints + accent ramps are
// derived from the anchors by tint/shade interpolation.
// ---------------------------------------------------------------------------

const masrafyPrimaryLight = MasrafyBrandTone(
  main: Color(0xFF283382),
  bg: Color(0xFFEEEFF5),
  bgHover: Color(0xFFDFE0EC),
  border: Color(0xFF8099CB),
  borderHover: Color(0xFF4D57A8),
  hover: Color(0xFF4D57A8),
  active: Color(0xFF1B2776),
  text: Color(0xFF283382),
  textHover: Color(0xFF4D57A8),
  textActive: Color(0xFF1B2776),
  outline: Color(0x1A283382),
);

const masrafyPrimaryDark = MasrafyBrandTone(
  main: Color(0xFF4D57A8),
  bg: Color(0xFF0E1E44),
  bgHover: Color(0xFF162550),
  border: Color(0xFF202E61),
  borderHover: Color(0xFF2B3872),
  hover: Color(0xFF7A81BE),
  active: Color(0xFF283382),
  text: Color(0xFF4D57A8),
  textHover: Color(0xFF7A81BE),
  textActive: Color(0xFF283382),
  outline: Color(0x264D57A8),
);

const masrafySecondaryLight = MasrafyBrandTone(
  main: Color(0xFF0082F8),
  bg: Color(0xFFEBF5FE),
  bgHover: Color(0xFFD9ECFE),
  border: Color(0xFFA6CEFF),
  borderHover: Color(0xFF3990FF),
  hover: Color(0xFF3990FF),
  active: Color(0xFF005DB5),
  text: Color(0xFF0082F8),
  textHover: Color(0xFF3990FF),
  textActive: Color(0xFF005DB5),
  outline: Color(0x1A0082F8),
);

const masrafySecondaryDark = MasrafyBrandTone(
  main: Color(0xFF3990FF),
  bg: Color(0xFF0B2752),
  bgHover: Color(0xFF103467),
  border: Color(0xFF184583),
  borderHover: Color(0xFF2058A2),
  hover: Color(0xFF6BACFF),
  active: Color(0xFF0082F8),
  text: Color(0xFF3990FF),
  textHover: Color(0xFF6BACFF),
  textActive: Color(0xFF0082F8),
  outline: Color(0x263990FF),
);

const masrafySuccessLight = MasrafyBrandTone(
  main: Color(0xFF21A05A),
  bg: Color(0xFFEDF7F2),
  bgHover: Color(0xFFDEF1E6),
  border: Color(0xFF9BD4B5),
  borderHover: Color(0xFF52B57E),
  hover: Color(0xFF52B57E),
  active: Color(0xFF1B834A),
  text: Color(0xFF21A05A),
  textHover: Color(0xFF52B57E),
  textActive: Color(0xFF1B834A),
  outline: Color(0x1A21A05A),
);

const masrafySuccessDark = MasrafyBrandTone(
  main: Color(0xFF42AE73),
  bg: Color(0xFF04130B),
  bgHover: Color(0xFF072012),
  border: Color(0xFF0B361F),
  borderHover: Color(0xFF104D2B),
  hover: Color(0xFF71C296),
  active: Color(0xFF21A05A),
  text: Color(0xFF42AE73),
  textHover: Color(0xFF71C296),
  textActive: Color(0xFF21A05A),
  outline: Color(0x2621A05A),
);

const masrafyWarningLight = MasrafyBrandTone(
  main: Color(0xFFFCBC2B),
  bg: Color(0xFFFFFAEE),
  bgHover: Color(0xFFFFF5DF),
  border: Color(0xFFFEE1A0),
  borderHover: Color(0xFFFDCB5A),
  hover: Color(0xFFFDCB5A),
  active: Color(0xFFCF9A23),
  text: Color(0xFFFCBC2B),
  textHover: Color(0xFFFDCB5A),
  textActive: Color(0xFFCF9A23),
  outline: Color(0x1AFCBC2B),
);

const masrafyWarningDark = MasrafyBrandTone(
  main: Color(0xFFFCBC2B),
  bg: Color(0xFF1E1705),
  bgHover: Color(0xFF322609),
  border: Color(0xFF56400F),
  borderHover: Color(0xFF795A15),
  hover: Color(0xFFFDCB5A),
  active: Color(0xFFDEA526),
  text: Color(0xFFFCBC2B),
  textHover: Color(0xFFFDCB5A),
  textActive: Color(0xFFDEA526),
  outline: Color(0x26FCBC2B),
);

// Info reuses the Secondary blue tone (classic "info" = blue).
const masrafyInfoLight = masrafySecondaryLight;
const masrafyInfoDark = masrafySecondaryDark;

const masrafyErrorLight = MasrafyBrandTone(
  main: Color(0xFFD3292C),
  bg: Color(0xFFFBEEEE),
  bgHover: Color(0xFFF8DFDF),
  border: Color(0xFFEB9FA0),
  borderHover: Color(0xFFDD585A),
  hover: Color(0xFFDD585A),
  active: Color(0xFFAD2224),
  text: Color(0xFFD3292C),
  textHover: Color(0xFFDD585A),
  textActive: Color(0xFFAD2224),
  outline: Color(0x1AD3292C),
);

const masrafyErrorDark = MasrafyBrandTone(
  main: Color(0xFFD84345),
  bg: Color(0xFF190505),
  bgHover: Color(0xFF2A0809),
  border: Color(0xFF480E0F),
  borderHover: Color(0xFF651415),
  hover: Color(0xFFE16C6E),
  active: Color(0xFFD3292C),
  text: Color(0xFFD84345),
  textHover: Color(0xFFE16C6E),
  textActive: Color(0xFFD3292C),
  outline: Color(0x26D3292C),
);

// Links follow the Secondary blue triplet.
const masrafyLinkLight = MasrafyLinkColors(
  main: Color(0xFF0082F8),
  hover: Color(0xFF3990FF),
  active: Color(0xFF005DB5),
);

const masrafyLinkDark = MasrafyLinkColors(
  main: Color(0xFF3990FF),
  hover: Color(0xFF6BACFF),
  active: Color(0xFF0082F8),
);

// Controls (checkbox / radio / toggle) take the Primary indigo selection bg.
const masrafyControlLight = MasrafyControlColors(
  itemBgActive: Color(0xFFEEEFF5),
  itemBgActiveDisabled: Color(0x26000000),
  itemBgActiveHover: Color(0xFFDFE0EC),
  itemBgHover: Color(0x0A000000),
  outline: Color(0x1A283382),
  tmpOutline: Color(0x05000000),
);

const masrafyControlDark = MasrafyControlColors(
  itemBgActive: Color(0xFF0E1E44),
  itemBgActiveDisabled: Color(0x2EFFFFFF),
  itemBgActiveHover: Color(0xFF162550),
  itemBgHover: Color(0x14FFFFFF),
  outline: Color(0x264D57A8),
  tmpOutline: Color(0x0AFFFFFF),
);

// ---------------------------------------------------------------------------
// Dashboard — medal, crown, chart tokens
// NOT from Figma "Mode 1" (no data-viz tokens supplied). Retained from the
// pilot100 baseline; revisit when a Masrafy data-viz palette is defined.
// ---------------------------------------------------------------------------

class MasrafyMedalColors {
  const MasrafyMedalColors({
    required this.gold,
    required this.silver,
    required this.bronze,
  });

  final Color gold;
  final Color silver;
  final Color bronze;

  MasrafyMedalColors lerp(MasrafyMedalColors other, double t) {
    return MasrafyMedalColors(
      gold: Color.lerp(gold, other.gold, t) ?? gold,
      silver: Color.lerp(silver, other.silver, t) ?? silver,
      bronze: Color.lerp(bronze, other.bronze, t) ?? bronze,
    );
  }
}

class MasrafyCrownColors {
  const MasrafyCrownColors({required this.fill, required this.stroke});

  final Color fill;
  final Color stroke;

  MasrafyCrownColors lerp(MasrafyCrownColors other, double t) {
    return MasrafyCrownColors(
      fill: Color.lerp(fill, other.fill, t) ?? fill,
      stroke: Color.lerp(stroke, other.stroke, t) ?? stroke,
    );
  }
}

class MasrafyChartColors {
  const MasrafyChartColors({
    required this.userLine,
    required this.averageLine,
    required this.userFill,
    required this.averageFill,
    required this.subjectRings,
    required this.indicator,
  });

  final Color userLine;
  final Color averageLine;
  final Color userFill;
  final Color averageFill;

  /// Brand-locked data-viz palette used by multi-ring radial charts.
  /// Order = innermost → outermost. NOT from Figma "Mode 1".
  final List<Color> subjectRings;

  /// Dark neutral dot used as the chart's focus indicator. Stays the
  /// same across modes since it sits on a white tooltip in both.
  final Color indicator;

  MasrafyChartColors lerp(MasrafyChartColors other, double t) {
    return MasrafyChartColors(
      userLine: Color.lerp(userLine, other.userLine, t) ?? userLine,
      averageLine:
          Color.lerp(averageLine, other.averageLine, t) ?? averageLine,
      userFill: Color.lerp(userFill, other.userFill, t) ?? userFill,
      averageFill:
          Color.lerp(averageFill, other.averageFill, t) ?? averageFill,
      // Ring palette is identity-mapped; lerp would muddy the brand
      // hues, so we snap to `other` past the half-way point.
      subjectRings: t < 0.5 ? subjectRings : other.subjectRings,
      indicator: Color.lerp(indicator, other.indicator, t) ?? indicator,
    );
  }
}

const masrafyMedalLight = MasrafyMedalColors(
  gold: Color(0xFFFFB700),
  silver: Color(0xFFA8B2BD),
  bronze: Color(0xFFC47035),
);

const masrafyMedalDark = MasrafyMedalColors(
  gold: Color(0xFFFFB700),
  silver: Color(0xFFA8B2BD),
  bronze: Color(0xFFC47035),
);

const masrafyCrownLight = MasrafyCrownColors(
  fill: Color(0xFFFFB700),
  stroke: Color(0xFFD48806),
);

const masrafyCrownDark = MasrafyCrownColors(
  fill: Color(0xFFFFB700),
  stroke: Color(0xFFD48806),
);

// Multi-ring data-viz palette. NOT from Figma "Mode 1"; brand-locked so the
// same hues read identically across light + dark modes.
const _masrafyChartSubjectRings = <Color>[
  Color(0xFF9E49F9),
  Color(0xFF47D3A2),
  Color(0xFFFFB743),
  Color(0xFFFF3F5F),
];

const _masrafyChartIndicator = Color(0xFF2D2D2D);

const masrafyChartLight = MasrafyChartColors(
  userLine: Color(0xFF283382),
  averageLine: Color(0xFFFF7A45),
  userFill: Color(0x33283382),
  averageFill: Color(0x33FF7A45),
  subjectRings: _masrafyChartSubjectRings,
  indicator: _masrafyChartIndicator,
);

const masrafyChartDark = MasrafyChartColors(
  userLine: Color(0xFF4D57A8),
  averageLine: Color(0xFFE87040),
  userFill: Color(0x224D57A8),
  averageFill: Color(0x22E87040),
  subjectRings: _masrafyChartSubjectRings,
  indicator: _masrafyChartIndicator,
);
