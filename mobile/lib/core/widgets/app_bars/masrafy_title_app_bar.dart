import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/app_bars/masrafy_app_bar.dart';

/// Standard secondary-screen app bar: back button + title + optional actions.
///
/// ```dart
/// MasrafyTitleAppBar(
///   title: 'Notifications',
///   trailingIcons: [
///     MasrafyAppBarAction(svgAsset: MasrafyAssets.kNotifSearch, onTap: _openSearch),
///   ],
/// )
/// ```
class MasrafyTitleAppBar extends MasrafyAppBar {
  MasrafyTitleAppBar({
    super.key,
    required this.title,
    this.showBackButton = true,
    this.onBack,
    List<MasrafyAppBarAction> trailingIcons = const [],
    MasrafyAppBarTextAction? textAction,
    Widget? customTrailing,
    super.autoBlur,
  })  : _trailingIcons = trailingIcons,
        _textAction = textAction,
        _customTrailing = customTrailing;

  final String title;
  final bool showBackButton;

  /// Overrides the default [context.router.maybePop] behaviour.
  final VoidCallback? onBack;

  final List<MasrafyAppBarAction> _trailingIcons;
  final MasrafyAppBarTextAction? _textAction;
  final Widget? _customTrailing;

  @override
  bool get showBack => showBackButton;

  @override
  VoidCallback? get onLeadingTap => onBack;

  @override
  List<MasrafyAppBarAction> get trailingActions => _trailingIcons;

  @override
  MasrafyAppBarTextAction? get trailingTextAction => _textAction;

  @override
  Widget? get customTrailingWidget => _customTrailing;

  @override
  Widget buildContent(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return Text(
      title,
      style: text.heading5.semiBold().copyWith(color: colors.text.primary),
      overflow: TextOverflow.ellipsis,
    );
  }
}
