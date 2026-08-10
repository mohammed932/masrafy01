import 'package:flutter/painting.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';

/// One canonical geometry AND surface for every single-line form control — text
/// inputs ([MasrafyLabeledField]), selects ([MasrafySelectField]), the
/// date-of-birth trigger ([MasrafyDobSelector]) and the phone row
/// ([MasrafyPhoneField]).
///
/// Each of those used to size itself from its own padding and radius, so a form
/// mixing them (e.g. sign-up: names + phone + email + birthday + password)
/// rendered three field heights in two visual families — soft grey pills next
/// to outlined boxes. They all read these values instead: one raised family,
/// [fillFor] plate + hairline outline + [shadowFor] lift, [height] tall.
abstract final class MasrafyFieldMetrics {
  /// Outer height of a single-line field, border included. 48 is the Material
  /// minimum tap target.
  static double get height => 48.h;

  /// Inset from the field's border to its text / icons.
  static double get horizontalPadding => 14.w;

  /// Corner radius of the field box.
  static double get radius => 12.r;

  /// Stroke width of the MEANING-carrying states only — focus and error. There
  /// is no resting outline: the [fillFor] plate + [shadowFor] lift draw the box,
  /// so a resting stroke would only add noise to a long form.
  ///
  /// One width across the states that do stroke: `OutlineInputBorder` strokes
  /// centred on the box edge, so a thicker focus ring visibly grows the field
  /// and jitters the form — state is signalled by colour, never by weight.
  static double get borderWidth => 1;

  /// Gap between a field's label and the field itself.
  static double get labelGap => 6.h;

  /// Plate a field sits on: the opaque container tone (white in light, the navy
  /// container in dark), so a control reads as a raised surface on the tinted
  /// layout instead of a hole cut into it. A disabled field drops to the flat
  /// translucent fill — inert, not liftable.
  static Color fillFor(MasrafyColorTheme colors, {bool enabled = true}) =>
      enabled ? colors.bg.container : colors.fill.quaternary;

  /// Two-stop ambient lift under a field. Tinted from `bg.mask`, which is the
  /// only token that already carries the right shadow HUE in both themes (navy
  /// on light, black on dark) — its own alpha is a scrim's and is replaced here.
  ///
  /// Tight contact shadow + wide soft one: a single blur either looks like a
  /// smudge or leaves the field floating. With no resting outline this lift is
  /// the ONLY thing separating a field from the layout, so the contact stop is
  /// what keeps the edge readable. [focused] adds a brand-tinted glow.
  static List<BoxShadow> shadowFor(
    MasrafyColorTheme colors, {
    bool focused = false,
  }) {
    final tint = colors.bg.mask;
    return [
      BoxShadow(
        color: tint.withValues(alpha: 0.06),
        blurRadius: 2,
        offset: const Offset(0, 1),
      ),
      BoxShadow(
        color: tint.withValues(alpha: focused ? 0.09 : 0.07),
        blurRadius: focused ? 16 : 10,
        offset: Offset(0, focused ? 5 : 3),
      ),
      if (focused)
        BoxShadow(
          color: colors.primary.main.withValues(alpha: 0.13),
          blurRadius: 14,
          offset: const Offset(0, 4),
        ),
    ];
  }

  /// Full box for the container-built fields (select, multi-select, DOB, phone):
  /// plate + radius + lift, and a stroke ONLY when [borderColor] is passed —
  /// i.e. for the states that carry meaning (focus, error). A resting field is
  /// borderless by design; see [borderWidth].
  static BoxDecoration decorationFor(
    MasrafyColorTheme colors, {
    bool enabled = true,
    bool focused = false,
    Color? borderColor,
  }) =>
      BoxDecoration(
        color: fillFor(colors, enabled: enabled),
        border: borderColor == null
            ? null
            : Border.all(color: borderColor, width: borderWidth),
        borderRadius: BorderRadius.circular(radius),
        boxShadow: enabled ? shadowFor(colors, focused: focused) : null,
      );

  /// Same surface for the `TextField`-built fields, whose `InputDecoration`
  /// owns its own (focus / error) stroke — painting one here too would double it.
  static BoxDecoration surfaceFor(
    MasrafyColorTheme colors, {
    bool enabled = true,
    bool focused = false,
  }) =>
      BoxDecoration(
        color: fillFor(colors, enabled: enabled),
        borderRadius: BorderRadius.circular(radius),
        boxShadow: enabled ? shadowFor(colors, focused: focused) : null,
      );

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
