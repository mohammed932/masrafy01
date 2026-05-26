import 'package:flutter/material.dart';

class PilotFontFamily {
  const PilotFontFamily({required this.main, required this.code});

  final String main;
  final String code;

  static const standard = PilotFontFamily(
    main: 'Inter',
    code: 'Courier Prime',
  );
}

class PilotFontSizes {
  const PilotFontSizes({
    required this.base,
    required this.lg,
    required this.sm,
    required this.xl,
    required this.heading1,
    required this.heading2,
    required this.heading3,
    required this.heading4,
    required this.heading5,
    required this.icon,
  });

  final double base;
  final double lg;
  final double sm;
  final double xl;
  final double heading1;
  final double heading2;
  final double heading3;
  final double heading4;
  final double heading5;
  final double icon;

  static const standard = PilotFontSizes(
    base: 14,
    lg: 16,
    sm: 12,
    xl: 20,
    heading1: 38,
    heading2: 30,
    heading3: 24,
    heading4: 20,
    heading5: 16,
    icon: 12,
  );

  static const compact = PilotFontSizes(
    base: 12,
    lg: 14,
    sm: 10,
    xl: 16,
    heading1: 32,
    heading2: 26,
    heading3: 20,
    heading4: 16,
    heading5: 14,
    icon: 12,
  );
}

class PilotLineHeights {
  const PilotLineHeights({
    required this.base,
    required this.lg,
    required this.sm,
    required this.heading1,
    required this.heading2,
    required this.heading3,
    required this.heading4,
    required this.heading5,
  });

  final double base;
  final double lg;
  final double sm;
  final double heading1;
  final double heading2;
  final double heading3;
  final double heading4;
  final double heading5;

  static const standard = PilotLineHeights(
    base: 22,
    lg: 24,
    sm: 20,
    heading1: 46,
    heading2: 38,
    heading3: 32,
    heading4: 28,
    heading5: 24,
  );

  static const compact = PilotLineHeights(
    base: 20,
    lg: 22,
    sm: 18,
    heading1: 40,
    heading2: 34,
    heading3: 28,
    heading4: 24,
    heading5: 22,
  );
}

class PilotFontWeights {
  const PilotFontWeights({required this.normal, required this.strong});

  final FontWeight normal;
  final FontWeight strong;

  static const standard = PilotFontWeights(
    normal: FontWeight.w400,
    strong: FontWeight.w600,
  );
}
