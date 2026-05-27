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

const masrafyPrimaryLight = MasrafyBrandTone(
  main: Color(0xFF338284),
  bg: Color(0xFFF3FAF9),
  bgHover: Color(0xFFD7F0EE),
  border: Color(0xFFAEE1DE),
  borderHover: Color(0xFF7DCBC8),
  hover: Color(0xFF53ADAE),
  active: Color(0xFF2B7376),
  text: Color(0xFF338284),
  textHover: Color(0xFF53ADAE),
  textActive: Color(0xFF2B7376),
);

const masrafyPrimaryDark = MasrafyBrandTone(
  main: Color(0xFF338284),
  bg: Color(0xFF0E2225),
  bgHover: Color(0xFF203F41),
  border: Color(0xFF224A4D),
  borderHover: Color(0xFF265C5F),
  hover: Color(0xFF53ADAE),
  active: Color(0xFF2B7376),
  text: Color(0xFF338284),
  textHover: Color(0xFF53ADAE),
  textActive: Color(0xFF2B7376),
);

const masrafySuccessLight = MasrafyBrandTone(
  main: Color(0xFF52C41A),
  bg: Color(0xFFF6FFED),
  bgHover: Color(0xFFD9F7BE),
  border: Color(0xFFB7EB8F),
  borderHover: Color(0xFF95DE64),
  hover: Color(0xFF95DE64),
  active: Color(0xFF389E0D),
  text: Color(0xFF52C41A),
  textHover: Color(0xFF73D13D),
  textActive: Color(0xFF389E0D),
);

const masrafySuccessDark = MasrafyBrandTone(
  main: Color(0xFF49AA19),
  bg: Color(0xFF162312),
  bgHover: Color(0xFF1D3712),
  border: Color(0xFF274916),
  borderHover: Color(0xFF306317),
  hover: Color(0xFF306317),
  active: Color(0xFF3C8618),
  text: Color(0xFF49AA19),
  textHover: Color(0xFF6ABE39),
  textActive: Color(0xFF3C8618),
);

const masrafyWarningLight = MasrafyBrandTone(
  main: Color(0xFFFAAD14),
  bg: Color(0xFFFFFBE6),
  bgHover: Color(0xFFFFF1B8),
  border: Color(0xFFFFE58F),
  borderHover: Color(0xFFFFD666),
  hover: Color(0xFFFFD666),
  active: Color(0xFFD48806),
  text: Color(0xFFFAAD14),
  textHover: Color(0xFFFFC53D),
  textActive: Color(0xFFD48806),
  outline: Color(0x1AFFD705),
);

const masrafyWarningDark = MasrafyBrandTone(
  main: Color(0xFFD89614),
  bg: Color(0xFF2B2111),
  bgHover: Color(0xFF443111),
  border: Color(0xFF594214),
  borderHover: Color(0xFF7C5914),
  hover: Color(0xFF7C5914),
  active: Color(0xFFAA7714),
  text: Color(0xFFD89614),
  textHover: Color(0xFFE8B339),
  textActive: Color(0xFFAA7714),
  outline: Color(0x26AD6B00),
);

const masrafyInfoLight = masrafyPrimaryLight;
const masrafyInfoDark = masrafyPrimaryDark;

const masrafyErrorLight = MasrafyBrandTone(
  main: Color(0xFFFF4D4F),
  bg: Color(0xFFFFF2F0),
  bgHover: Color(0xFFFFF1F0),
  border: Color(0xFFFFCCC7),
  borderHover: Color(0xFFFFA39E),
  hover: Color(0xFFFF7875),
  active: Color(0xFFD9363E),
  text: Color(0xFFFF4D4F),
  textHover: Color(0xFFFF7875),
  textActive: Color(0xFFD9363E),
  outline: Color(0x0FFF2606),
);

const masrafyErrorDark = MasrafyBrandTone(
  main: Color(0xFFDC4446),
  bg: Color(0xFF2C1618),
  bgHover: Color(0xFF451D1F),
  border: Color(0xFF5B2526),
  borderHover: Color(0xFF7E2E2F),
  hover: Color(0xFFE86E6B),
  active: Color(0xFFAD393A),
  text: Color(0xFFDC4446),
  textHover: Color(0xFFE86E6B),
  textActive: Color(0xFFAD393A),
  outline: Color(0x1CEE2638),
);

const masrafyLinkLight = MasrafyLinkColors(
  main: Color(0xFF338284),
  hover: Color(0xFF53ADAE),
  active: Color(0xFF2B7376),
);

const masrafyLinkDark = MasrafyLinkColors(
  main: Color(0xFF338284),
  hover: Color(0xFF53ADAE),
  active: Color(0xFF2B7376),
);

const masrafyControlLight = MasrafyControlColors(
  itemBgActive: Color(0xFFF3FAF9),
  itemBgActiveDisabled: Color(0x26000000),
  itemBgActiveHover: Color(0xFFD7F0EE),
  itemBgHover: Color(0x0A000000),
  outline: Color(0x1A0591FF),
  tmpOutline: Color(0x05000000),
);

const masrafyControlDark = MasrafyControlColors(
  itemBgActive: Color(0xFF0E2225),
  itemBgActiveDisabled: Color(0x2EFFFFFF),
  itemBgActiveHover: Color(0xFF203F41),
  itemBgHover: Color(0x14FFFFFF),
  outline: Color(0x26003CB4),
  tmpOutline: Color(0x0AFFFFFF),
);

// ---------------------------------------------------------------------------
// Dashboard — medal, crown, chart tokens
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

  /// Brand-locked data-viz palette used by multi-ring radial charts
  /// (e.g. `PlanSubjectsSummaryCard`). Order = innermost → outermost.
  /// Same in light + dark per Figma 3268:100917.
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

// Multi-ring data-viz palette (Figma node 3268:100917). Brand-locked
// so the same hues read identically across light + dark modes.
// Order = innermost → outermost (Air Law / Principles / Mass /
// Performance in the canonical 4-subject layout).
const _masrafyChartSubjectRings = <Color>[
  Color(0xFF9E49F9),
  Color(0xFF47D3A2),
  Color(0xFFFFB743),
  Color(0xFFFF3F5F),
];

const _masrafyChartIndicator = Color(0xFF2D2D2D);

const masrafyChartLight = MasrafyChartColors(
  userLine: Color(0xFF338284),
  averageLine: Color(0xFFFF7A45),
  userFill: Color(0x33338284),
  averageFill: Color(0x33FF7A45),
  subjectRings: _masrafyChartSubjectRings,
  indicator: _masrafyChartIndicator,
);

const masrafyChartDark = MasrafyChartColors(
  userLine: Color(0xFF53ADAE),
  averageLine: Color(0xFFE87040),
  userFill: Color(0x2253ADAE),
  averageFill: Color(0x22E87040),
  subjectRings: _masrafyChartSubjectRings,
  indicator: _masrafyChartIndicator,
);
