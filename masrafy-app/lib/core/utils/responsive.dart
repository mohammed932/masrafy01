import 'package:flutter/material.dart';
import 'package:app/core/theme/masrafy_ui_kit.dart';

/// Single source of truth for device-class breakpoints and content max
/// widths used across the app. Use this instead of redefining local
/// `_kTabletBreakpoint` constants or hard-coding `BoxConstraints(maxWidth: X)`
/// values inside screens.
///
/// Breakpoints follow `shortestSide` (not raw width) so that an iPad in
/// landscape is still classified as `tablet` even though `width` is large.
class Responsive {
  Responsive._();

  static const double tabletBreakpoint = MasrafyUiKitInitializer.tabletBreakpoint;
  static const double largeTabletBreakpoint = 900;

  static const double phoneMaxContentWidth = double.infinity;
  static const double tabletFormMaxWidth = 480;
  static const double tabletCardMaxWidth = 560;
  static const double tabletReadingMaxWidth = 680;
  static const double largeTabletReadingMaxWidth = 760;

  static bool isTablet(BuildContext context) =>
      MediaQuery.sizeOf(context).shortestSide >= tabletBreakpoint;

  static bool isLargeTablet(BuildContext context) =>
      MediaQuery.sizeOf(context).shortestSide >= largeTabletBreakpoint;

  static bool isLandscape(BuildContext context) =>
      MediaQuery.orientationOf(context) == Orientation.landscape;

  /// Default content max width — use for scrollable bodies (long lists,
  /// dashboards) so they don't stretch across an iPad viewport.
  static double contentMaxWidth(BuildContext context) {
    if (!isTablet(context)) return double.infinity;
    return isLargeTablet(context)
        ? largeTabletReadingMaxWidth
        : tabletReadingMaxWidth;
  }

  /// Form / single-column input surfaces (auth, profile edit, settings).
  /// On phone it's the full screen; on tablet it stays in a comfortable
  /// reading column.
  static double formMaxWidth(BuildContext context) =>
      isTablet(context) ? tabletFormMaxWidth : double.infinity;

  /// Card-sized surfaces (Figma-intent decks, flip cards, summary panels).
  static double cardMaxWidth(BuildContext context) =>
      isTablet(context) ? tabletCardMaxWidth : double.infinity;

  /// Symmetric page padding that grows with device class. Combine with a
  /// `Center` + `ConstrainedBox` (or `MasrafyResponsiveContainer`) so content
  /// doesn't run edge-to-edge on iPad.
  static EdgeInsets pagePadding(BuildContext context) {
    if (isLargeTablet(context)) {
      return const EdgeInsets.symmetric(horizontal: 48);
    }
    if (isTablet(context)) {
      return const EdgeInsets.symmetric(horizontal: 32);
    }
    return const EdgeInsets.symmetric(horizontal: 16);
  }
}
