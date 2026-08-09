import 'package:flutter/painting.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

/// One canonical geometry for every single-line form control — text inputs
/// ([MasrafyLabeledField]), selects ([MasrafySelectField]), the date-of-birth
/// trigger ([MasrafyDobSelector]) and the phone row ([MasrafyPhoneField]).
///
/// Each of those used to size itself from its own padding and radius, so a form
/// mixing them (e.g. sign-up: names + phone + email + birthday + password)
/// rendered three field heights in two visual families — soft grey pills next
/// to outlined boxes. They all read these values instead: one outlined family,
/// transparent fill, [height] tall.
abstract final class MasrafyFieldMetrics {
  /// Outer height of a single-line field, border included. 48 is the Material
  /// minimum tap target.
  static double get height => 48.h;

  /// Inset from the field's border to its text / icons.
  static double get horizontalPadding => 14.w;

  /// Corner radius of the field box.
  static double get radius => 12.r;

  /// Stroke width of a field's outline, in EVERY state (resting, focused,
  /// error). One width across states on purpose: `OutlineInputBorder` strokes
  /// centred on the box edge, so a thicker focus ring visibly grows the field
  /// and jitters the form — focus is signalled by colour, never by weight.
  ///
  /// 1.5 rather than 1: paired with `border.field`, it is what makes an
  /// unfilled control read as a box from arm's length on a tinted layout.
  static double get borderWidth => 1.5;

  /// Gap between a field's label and the field itself.
  static double get labelGap => 6.h;

  /// Vertical content inset that makes a single-line [TextField] exactly
  /// [height] tall when rendering [style].
  ///
  /// A `SizedBox(height: …)` wrapper does NOT work here: `OutlineInputBorder`
  /// paints around the decorator's own content rect, so forcing a taller box
  /// leaves a squashed field with dead space underneath. The height has to come
  /// from the padding.
  /// `OutlineInputBorder` paints its 1px stroke *inside* the box, so the border
  /// adds nothing to the measured height — content padding + line box is the
  /// whole field.
  static double verticalPaddingFor(TextStyle style) {
    final lineBox = (style.fontSize ?? 14.sp) * (style.height ?? 1.0);
    final pad = (height - lineBox) / 2;
    return pad < 4.h ? 4.h : pad;
  }
}
