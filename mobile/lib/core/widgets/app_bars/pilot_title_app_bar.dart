import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/widgets/app_bars/pilot_app_bar.dart';

/// Standard secondary-screen app bar: back button + title + optional actions.
///
/// ```dart
/// PilotTitleAppBar(
///   title: 'Notifications',
///   trailingIcons: [
///     PilotAppBarAction(svgAsset: PilotAssets.kNotifSearch, onTap: _openSearch),
///   ],
/// )
/// ```
class PilotTitleAppBar extends PilotAppBar {
  PilotTitleAppBar({
    super.key,
    required this.title,
    this.showBackButton = true,
    this.onBack,
    List<PilotAppBarAction> trailingIcons = const [],
    PilotAppBarTextAction? textAction,
    Widget? customTrailing,
    super.autoBlur,
  })  : _trailingIcons = trailingIcons,
        _textAction = textAction,
        _customTrailing = customTrailing;

  final String title;
  final bool showBackButton;

  /// Overrides the default [context.router.maybePop] behaviour.
  final VoidCallback? onBack;

  final List<PilotAppBarAction> _trailingIcons;
  final PilotAppBarTextAction? _textAction;
  final Widget? _customTrailing;

  @override
  bool get showBack => showBackButton;

  @override
  VoidCallback? get onLeadingTap => onBack;

  @override
  List<PilotAppBarAction> get trailingActions => _trailingIcons;

  @override
  PilotAppBarTextAction? get trailingTextAction => _textAction;

  @override
  Widget? get customTrailingWidget => _customTrailing;

  @override
  Widget buildContent(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final text = PilotTextTheme.of(context);
    return Text(
      title,
      style: text.heading5.semiBold().copyWith(color: colors.text.primary),
      overflow: TextOverflow.ellipsis,
    );
  }
}
