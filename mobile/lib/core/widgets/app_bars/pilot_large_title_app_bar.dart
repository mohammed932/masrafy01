import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/widgets/app_bars/pilot_app_bar.dart';

/// Top-level screen app bar: large left-aligned title + optional trailing actions.
/// No back button — used for root tabs (Dashboard, E-Shop, etc.).
///
/// ```dart
/// PilotLargeTitleAppBar(
///   title: 'Dashboard',
///   trailingIcons: [
///     PilotAppBarAction(svgAsset: PilotAssets.kNotifNotificationBell, onTap: _openNotifs),
///   ],
/// )
/// ```
class PilotLargeTitleAppBar extends PilotAppBar {
  PilotLargeTitleAppBar({
    super.key,
    required this.title,
    this.titleWidget,
    List<PilotAppBarAction> trailingIcons = const [],
    PilotAppBarTextAction? textAction,
    Widget? customTrailing,
    super.autoBlur,
  })  : _trailingIcons = trailingIcons,
        _textAction = textAction,
        _customTrailing = customTrailing;

  final String title;

  /// Optional widget rendered in place of the default title [Text].
  /// Useful for embedding badges or custom layouts next to the title.
  final Widget? titleWidget;

  final List<PilotAppBarAction> _trailingIcons;
  final PilotAppBarTextAction? _textAction;
  final Widget? _customTrailing;

  @override
  bool get showBack => false;

  @override
  List<PilotAppBarAction> get trailingActions => _trailingIcons;

  @override
  PilotAppBarTextAction? get trailingTextAction => _textAction;

  @override
  Widget? get customTrailingWidget => _customTrailing;

  @override
  Widget buildContent(BuildContext context) {
    if (titleWidget != null) return titleWidget!;
    final colors = PilotColorTheme.of(context);
    final text = PilotTextTheme.of(context);
    return Text(
      title,
      style: text.heading3.bold().copyWith(color: colors.text.heading),
      overflow: TextOverflow.ellipsis,
    );
  }
}
