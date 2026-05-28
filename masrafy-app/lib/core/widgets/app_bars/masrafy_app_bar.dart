import 'dart:ui';

import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/utils/masrafy_assets.dart';

/// Icon-button action for the trailing area of a [MasrafyAppBar].
class MasrafyAppBarAction {
  const MasrafyAppBarAction({
    required this.svgAsset,
    required this.onTap,
    this.isPrimary = false,
    this.show = true,
  });

  final String svgAsset;
  final VoidCallback onTap;

  /// When true the button is filled with [MasrafyColorTheme.primary.main] and
  /// uses a white icon tint instead of the default bordered pill style.
  final bool isPrimary;
  final bool show;
}

/// Text-label action for the trailing area of a [MasrafyAppBar].
class MasrafyAppBarTextAction {
  const MasrafyAppBarTextAction({
    required this.label,
    required this.onTap,
    this.show = true,
  });

  final String label;
  final VoidCallback onTap;
  final bool show;
}

/// Abstract base for all Masrafy app bars.
///
/// Concrete subclasses implement [buildContent] (the title/center area) and
/// override [showBack], [trailingActions], and friends as needed.
///
/// The bar detects scroll events from a nested scrollable and applies a
/// [BackdropFilter] blur once the user scrolls past 16 px (toggle via
/// [autoBlur]).
abstract class MasrafyAppBar extends StatelessWidget implements PreferredSizeWidget {
  MasrafyAppBar({super.key, this.autoBlur = true});

  final bool autoBlur;

  // Kept as an instance field — valid for StatelessWidget because Flutter
  // reconciles elements and reuses the same widget instance within a route.
  final ValueNotifier<double> _blurNotifier = ValueNotifier(0);

  @override
  Size get preferredSize => Size.fromHeight(56.h);

  // ── Overridable slots ─────────────────────────────────────────────────────

  Widget buildContent(BuildContext context);

  bool get showBack => false;

  /// Called when the back button is tapped. Defaults to [context.router.maybePop].
  VoidCallback? get onLeadingTap => null;

  List<MasrafyAppBarAction> get trailingActions => const [];

  MasrafyAppBarTextAction? get trailingTextAction => null;

  /// Arbitrary widget appended after all [trailingActions].
  /// Use for complex trailing content (badges, avatars, value-listenable stacks)
  /// that cannot be expressed as a simple [MasrafyAppBarAction].
  Widget? get customTrailingWidget => null;

  // ── Internal builders ─────────────────────────────────────────────────────

  Widget _buildLeading(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return GestureDetector(
      onTap: onLeadingTap ?? () => context.router.maybePop(),
      child: Container(
        width: 40.r,
        height: 40.r,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8.r),
        ),
        child: SvgPicture.asset(
          MasrafyAssets.kNotifArrowLeft,
          width: 24.r,
          height: 24.r,
          colorFilter: ColorFilter.mode(colors.text.primary, BlendMode.srcIn),
        ),
      ),
    );
  }

  Widget _buildActionButton(MasrafyAppBarAction action, BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return GestureDetector(
      onTap: action.onTap,
      child: Container(
        width: 40.r,
        height: 40.r,
        decoration: BoxDecoration(
          color: action.isPrimary ? colors.primary.main : colors.fill.quaternary,
          borderRadius: BorderRadius.circular(24.r),
          border: action.isPrimary
              ? null
              : Border.all(color: colors.border.main),
        ),
        alignment: Alignment.center,
        child: SvgPicture.asset(
          action.svgAsset,
          width: 20.r,
          height: 20.r,
          colorFilter: ColorFilter.mode(
            action.isPrimary ? colors.white : colors.icon.main,
            BlendMode.srcIn,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final visibleActions = trailingActions.where((a) => a.show).toList();
    final textAction = trailingTextAction;

    return ValueListenableBuilder<double>(
      valueListenable: _blurNotifier,
      builder: (ctx, blur, _) {
        return ClipRRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
            child: AppBar(
              notificationPredicate: autoBlur
                  ? (notification) {
                      if (notification.metrics.axis == Axis.vertical) {
                        _blurNotifier.value =
                            notification.metrics.pixels > 16 ? 25 : 0;
                      }
                      return notification.depth == 0;
                    }
                  : defaultScrollNotificationPredicate,
              elevation: 0,
              scrolledUnderElevation: 0,
              automaticallyImplyLeading: false,
              // Non-empty `actions` blocks Material's auto-injected
              // end-drawer hamburger. Real trailing widgets live inside
              // `title` for layout control; this 0-size placeholder just
              // keeps the actions slot non-empty.
              actions: const <Widget>[SizedBox.shrink()],
              titleSpacing: 0,
              title: Padding(
                padding: EdgeInsets.symmetric(horizontal: 16.w),
                child: Row(
                  children: [
                    if (showBack) ...[
                      _buildLeading(ctx),
                      Gap(12.w),
                    ],
                    Expanded(child: buildContent(ctx)),
                    if (textAction != null && textAction.show) ...[
                      Gap(8.w),
                      GestureDetector(
                        onTap: textAction.onTap,
                        child: Text(
                          textAction.label,
                          style: MasrafyTextTheme.of(ctx)
                              .bodyLarge
                              .semiBold()
                              .copyWith(color: colors.primary.main),
                        ),
                      ),
                    ],
                    for (final action in visibleActions) ...[
                      Gap(8.w),
                      _buildActionButton(action, ctx),
                    ],
                    if (customTrailingWidget != null) ...[
                      Gap(8.w),
                      customTrailingWidget!,
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
