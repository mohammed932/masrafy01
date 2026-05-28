import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/typography/masrafy_typography_tokens.dart';

export 'package:app/core/theme/typography/masrafy_typography_tokens.dart';

class MasrafyTextTheme extends ThemeExtension<MasrafyTextTheme> {
  const MasrafyTextTheme({
    required this.fontFamily,
    required this.fontSize,
    required this.lineHeight,
    required this.fontWeight,
  });

  final MasrafyFontFamily fontFamily;
  final MasrafyFontSizes fontSize;
  final MasrafyLineHeights lineHeight;
  final MasrafyFontWeights fontWeight;

  static const standard = MasrafyTextTheme(
    fontFamily: MasrafyFontFamily.standard,
    fontSize: MasrafyFontSizes.standard,
    lineHeight: MasrafyLineHeights.standard,
    fontWeight: MasrafyFontWeights.standard,
  );

  static const compact = MasrafyTextTheme(
    fontFamily: MasrafyFontFamily.standard,
    fontSize: MasrafyFontSizes.compact,
    lineHeight: MasrafyLineHeights.compact,
    fontWeight: MasrafyFontWeights.standard,
  );

  static MasrafyTextTheme of(BuildContext context) =>
      Theme.of(context).extension<MasrafyTextTheme>() ?? standard;

  TextStyle _style({
    required double size,
    required double height,
    required FontWeight weight,
    String? family,
  }) {
    return TextStyle(
      fontFamily: family ?? fontFamily.main,
      fontSize: size.sp,
      height: height / size,
      fontWeight: weight,
    );
  }

  TextStyle get heading1 => _style(
        size: fontSize.heading1,
        height: lineHeight.heading1,
        weight: fontWeight.strong,
      );
  TextStyle get heading2 => _style(
        size: fontSize.heading2,
        height: lineHeight.heading2,
        weight: fontWeight.strong,
      );
  TextStyle get heading3 => _style(
        size: fontSize.heading3,
        height: lineHeight.heading3,
        weight: fontWeight.strong,
      );
  TextStyle get heading4 => _style(
        size: fontSize.heading4,
        height: lineHeight.heading4,
        weight: fontWeight.strong,
      );
  TextStyle get heading5 => _style(
        size: fontSize.heading5,
        height: lineHeight.heading5,
        weight: fontWeight.strong,
      );

  TextStyle get body => _style(
        size: fontSize.base,
        height: lineHeight.base,
        weight: fontWeight.normal,
      );
  TextStyle get bodyLarge => _style(
        size: fontSize.lg,
        height: lineHeight.lg,
        weight: fontWeight.normal,
      );
  TextStyle get bodySmall => _style(
        size: fontSize.sm,
        height: lineHeight.sm,
        weight: fontWeight.normal,
      );
  TextStyle get bodyXLarge => _style(
        size: fontSize.xl,
        height: lineHeight.lg,
        weight: fontWeight.normal,
      );

  TextStyle get caption => _style(
        size: fontSize.sm,
        height: lineHeight.sm,
        weight: fontWeight.normal,
      );
  TextStyle get code => _style(
        size: fontSize.base,
        height: lineHeight.base,
        weight: fontWeight.normal,
        family: fontFamily.code,
      );

  @override
  MasrafyTextTheme copyWith({
    MasrafyFontFamily? fontFamily,
    MasrafyFontSizes? fontSize,
    MasrafyLineHeights? lineHeight,
    MasrafyFontWeights? fontWeight,
  }) {
    return MasrafyTextTheme(
      fontFamily: fontFamily ?? this.fontFamily,
      fontSize: fontSize ?? this.fontSize,
      lineHeight: lineHeight ?? this.lineHeight,
      fontWeight: fontWeight ?? this.fontWeight,
    );
  }

  @override
  MasrafyTextTheme lerp(ThemeExtension<MasrafyTextTheme>? other, double t) {
    if (other is! MasrafyTextTheme) return this;
    return t < 0.5 ? this : other;
  }
}

extension TextStyleWeightX on TextStyle {
  TextStyle bold() => copyWith(fontWeight: FontWeight.w700);
  TextStyle semiBold() => copyWith(fontWeight: FontWeight.w600);
  TextStyle medium() => copyWith(fontWeight: FontWeight.w500);
  TextStyle regular() => copyWith(fontWeight: FontWeight.w400);
}
