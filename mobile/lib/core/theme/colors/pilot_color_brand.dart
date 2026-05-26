import 'package:flutter/material.dart';

class PilotBrandTone {
  const PilotBrandTone({
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

  PilotBrandTone lerp(PilotBrandTone other, double t) {
    return PilotBrandTone(
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

class PilotLinkColors {
  const PilotLinkColors({
    required this.main,
    required this.hover,
    required this.active,
  });

  final Color main;
  final Color hover;
  final Color active;

  PilotLinkColors lerp(PilotLinkColors other, double t) {
    return PilotLinkColors(
      main: Color.lerp(main, other.main, t) ?? main,
      hover: Color.lerp(hover, other.hover, t) ?? hover,
      active: Color.lerp(active, other.active, t) ?? active,
    );
  }
}

class PilotControlColors {
  const PilotControlColors({
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

  PilotControlColors lerp(PilotControlColors other, double t) {
    return PilotControlColors(
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

const pilotPrimaryLight = PilotBrandTone(
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

const pilotPrimaryDark = PilotBrandTone(
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

const pilotSuccessLight = PilotBrandTone(
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

const pilotSuccessDark = PilotBrandTone(
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

const pilotWarningLight = PilotBrandTone(
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

const pilotWarningDark = PilotBrandTone(
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

const pilotInfoLight = pilotPrimaryLight;
const pilotInfoDark = pilotPrimaryDark;

const pilotErrorLight = PilotBrandTone(
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

const pilotErrorDark = PilotBrandTone(
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

const pilotLinkLight = PilotLinkColors(
  main: Color(0xFF338284),
  hover: Color(0xFF53ADAE),
  active: Color(0xFF2B7376),
);

const pilotLinkDark = PilotLinkColors(
  main: Color(0xFF338284),
  hover: Color(0xFF53ADAE),
  active: Color(0xFF2B7376),
);

const pilotControlLight = PilotControlColors(
  itemBgActive: Color(0xFFF3FAF9),
  itemBgActiveDisabled: Color(0x26000000),
  itemBgActiveHover: Color(0xFFD7F0EE),
  itemBgHover: Color(0x0A000000),
  outline: Color(0x1A0591FF),
  tmpOutline: Color(0x05000000),
);

const pilotControlDark = PilotControlColors(
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

class PilotMedalColors {
  const PilotMedalColors({
    required this.gold,
    required this.silver,
    required this.bronze,
  });

  final Color gold;
  final Color silver;
  final Color bronze;

  PilotMedalColors lerp(PilotMedalColors other, double t) {
    return PilotMedalColors(
      gold: Color.lerp(gold, other.gold, t) ?? gold,
      silver: Color.lerp(silver, other.silver, t) ?? silver,
      bronze: Color.lerp(bronze, other.bronze, t) ?? bronze,
    );
  }
}

class PilotCrownColors {
  const PilotCrownColors({required this.fill, required this.stroke});

  final Color fill;
  final Color stroke;

  PilotCrownColors lerp(PilotCrownColors other, double t) {
    return PilotCrownColors(
      fill: Color.lerp(fill, other.fill, t) ?? fill,
      stroke: Color.lerp(stroke, other.stroke, t) ?? stroke,
    );
  }
}

class PilotChartColors {
  const PilotChartColors({
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

  PilotChartColors lerp(PilotChartColors other, double t) {
    return PilotChartColors(
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

const pilotMedalLight = PilotMedalColors(
  gold: Color(0xFFFFB700),
  silver: Color(0xFFA8B2BD),
  bronze: Color(0xFFC47035),
);

const pilotMedalDark = PilotMedalColors(
  gold: Color(0xFFFFB700),
  silver: Color(0xFFA8B2BD),
  bronze: Color(0xFFC47035),
);

const pilotCrownLight = PilotCrownColors(
  fill: Color(0xFFFFB700),
  stroke: Color(0xFFD48806),
);

const pilotCrownDark = PilotCrownColors(
  fill: Color(0xFFFFB700),
  stroke: Color(0xFFD48806),
);

// Multi-ring data-viz palette (Figma node 3268:100917). Brand-locked
// so the same hues read identically across light + dark modes.
// Order = innermost → outermost (Air Law / Principles / Mass /
// Performance in the canonical 4-subject layout).
const _pilotChartSubjectRings = <Color>[
  Color(0xFF9E49F9),
  Color(0xFF47D3A2),
  Color(0xFFFFB743),
  Color(0xFFFF3F5F),
];

const _pilotChartIndicator = Color(0xFF2D2D2D);

const pilotChartLight = PilotChartColors(
  userLine: Color(0xFF338284),
  averageLine: Color(0xFFFF7A45),
  userFill: Color(0x33338284),
  averageFill: Color(0x33FF7A45),
  subjectRings: _pilotChartSubjectRings,
  indicator: _pilotChartIndicator,
);

const pilotChartDark = PilotChartColors(
  userLine: Color(0xFF53ADAE),
  averageLine: Color(0xFFE87040),
  userFill: Color(0x2253ADAE),
  averageFill: Color(0x22E87040),
  subjectRings: _pilotChartSubjectRings,
  indicator: _pilotChartIndicator,
);
