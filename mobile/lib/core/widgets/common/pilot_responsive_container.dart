import 'package:flutter/material.dart';
import 'package:app/core/utils/responsive.dart';

/// Centers content within a tablet-aware max-width column.
///
/// On phone it is effectively pass-through (no width cap). On tablet the
/// child is constrained to `kind`'s width and horizontally centered, so
/// forms / cards / lists don't stretch across the full iPad viewport.
///
/// Wrap the body of a screen (the part below the app bar) — not the
/// `Scaffold` itself — so backgrounds, app bars, and bottom nav still
/// span edge-to-edge.
class PilotResponsiveContainer extends StatelessWidget {
  const PilotResponsiveContainer({
    super.key,
    required this.child,
    this.kind = PilotResponsiveWidth.content,
    this.maxWidth,
    this.alignment = Alignment.topCenter,
    this.padding,
  });

  /// Convenience: form-column width (auth, settings forms).
  const PilotResponsiveContainer.form({
    super.key,
    required this.child,
    this.alignment = Alignment.topCenter,
    this.padding,
  })  : kind = PilotResponsiveWidth.form,
        maxWidth = null;

  /// Convenience: card-sized width (single-column card surfaces).
  const PilotResponsiveContainer.card({
    super.key,
    required this.child,
    this.alignment = Alignment.topCenter,
    this.padding,
  })  : kind = PilotResponsiveWidth.card,
        maxWidth = null;

  /// Convenience: reading-column width (long-form content, FAQ, etc.).
  const PilotResponsiveContainer.reading({
    super.key,
    required this.child,
    this.alignment = Alignment.topCenter,
    this.padding,
  })  : kind = PilotResponsiveWidth.content,
        maxWidth = null;

  final Widget child;
  final PilotResponsiveWidth kind;
  final double? maxWidth;
  final AlignmentGeometry alignment;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final width = maxWidth ?? _widthFor(context, kind);
    final wrapped = padding == null
        ? child
        : Padding(padding: padding!, child: child);
    if (!width.isFinite) return wrapped;
    return LayoutBuilder(
      builder: (context, constraints) {
        final parentWidth = constraints.maxWidth;
        if (!parentWidth.isFinite || parentWidth <= width) return wrapped;
        final sidePad = (parentWidth - width) / 2;
        return Padding(
          padding: EdgeInsets.symmetric(horizontal: sidePad),
          child: wrapped,
        );
      },
    );
  }

  static double _widthFor(BuildContext context, PilotResponsiveWidth kind) {
    switch (kind) {
      case PilotResponsiveWidth.form:
        return Responsive.formMaxWidth(context);
      case PilotResponsiveWidth.card:
        return Responsive.cardMaxWidth(context);
      case PilotResponsiveWidth.content:
        return Responsive.contentMaxWidth(context);
    }
  }
}

enum PilotResponsiveWidth { form, card, content }
