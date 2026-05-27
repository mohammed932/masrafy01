import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/app_bars/masrafy_app_bar.dart';

/// Top-level screen app bar: large left-aligned title + optional trailing actions.
/// No back button — used for root tabs (Dashboard, E-Shop, etc.).
///
/// ```dart
/// MasrafyLargeTitleAppBar(
///   title: 'Dashboard',
///   trailingIcons: [
///     MasrafyAppBarAction(svgAsset: MasrafyAssets.kNotifNotificationBell, onTap: _openNotifs),
///   ],
/// )
/// ```
class MasrafyLargeTitleAppBar extends MasrafyAppBar {
  MasrafyLargeTitleAppBar({
    super.key,
    required this.title,
    this.titleWidget,
    List<MasrafyAppBarAction> trailingIcons = const [],
    MasrafyAppBarTextAction? textAction,
    Widget? customTrailing,
    super.autoBlur,
  })  : _trailingIcons = trailingIcons,
        _textAction = textAction,
        _customTrailing = customTrailing;

  final String title;

  /// Optional widget rendered in place of the default title [Text].
  /// Useful for embedding badges or custom layouts next to the title.
  final Widget? titleWidget;

  final List<MasrafyAppBarAction> _trailingIcons;
  final MasrafyAppBarTextAction? _textAction;
  final Widget? _customTrailing;

  @override
  bool get showBack => false;

  @override
  List<MasrafyAppBarAction> get trailingActions => _trailingIcons;

  @override
  MasrafyAppBarTextAction? get trailingTextAction => _textAction;

  @override
  Widget? get customTrailingWidget => _customTrailing;

  @override
  Widget buildContent(BuildContext context) {
    if (titleWidget != null) return titleWidget!;
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return Text(
      title,
      style: text.heading3.bold().copyWith(color: colors.text.heading),
      overflow: TextOverflow.ellipsis,
    );
  }
}
