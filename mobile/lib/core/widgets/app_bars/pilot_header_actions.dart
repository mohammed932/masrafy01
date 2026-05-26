import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:gap/gap.dart';
import 'package:app/core/injection/injection.dart';
import 'package:app/core/router/router.dart';
import 'package:app/core/services/unread_count/unread_count_service.dart';
import 'package:app/core/services/user_service.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/utils/pilot_assets.dart';
import 'package:app/core/widgets/common/pilot_avatar.dart';
import 'package:app/features/menu_drawer/presentation/menu_drawer/menu_drawer.imports.dart';

/// Shared trailing-actions cluster used by every top-level screen header
/// (Dashboard, Saved Tests, Study Planner, Question Search, Set Study).
///
/// Renders three controls with the standard 16w gap:
///   1. Search pill — opens [QuestionSearchRoute]
///   2. Notification bell pill — opens [NotificationsRoute], with the
///      live unread badge from [UnreadCountService]
///   3. 40r [PilotAvatar] — opens [ProfileRoute]
///
/// Every action is overridable via a callback so a feature can intercept
/// (e.g. close a search field before navigating). Pass `showSearch: false`
/// or `showBell: false` to hide individual actions.
class PilotHeaderActions extends StatelessWidget {
  const PilotHeaderActions({
    super.key,
    this.onSearch,
    this.onNotifications,
    this.onProfile,
    this.showSearch = true,
    this.showBell = true,
    this.showAvatar = true,
  });

  final VoidCallback? onSearch;
  final VoidCallback? onNotifications;
  final VoidCallback? onProfile;
  final bool showSearch;
  final bool showBell;
  final bool showAvatar;

  void _defaultSearch(BuildContext context) =>
      context.router.push(const QuestionSearchRoute());

  void _defaultNotifications(BuildContext context) =>
      context.router.push(const NotificationsRoute());

  void _defaultProfile(BuildContext context) => MenuDrawer.openFor(context);

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final user = getIt<UserService>().user;
    final children = <Widget>[];

    if (showSearch) {
      children.add(
        _PillIcon(
          svgAsset: PilotAssets.kNotifSearch,
          onTap: onSearch ?? () => _defaultSearch(context),
          colors: colors,
          semanticsLabel: 'Search',
        ),
      );
    }
    if (showBell) {
      if (children.isNotEmpty) children.add(Gap(16.w));
      children.add(
        _PillIconWithBadge(
          svgAsset: PilotAssets.kNotifNotificationBell,
          onTap: onNotifications ?? () => _defaultNotifications(context),
          colors: colors,
          semanticsLabel: 'Notifications',
        ),
      );
    }
    if (showAvatar) {
      if (children.isNotEmpty) children.add(Gap(16.w));
      children.add(
        Semantics(
          label: 'Profile',
          button: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onProfile ?? () => _defaultProfile(context),
            child: PilotAvatar(
              size: 40.r,
              imageUrl: user?.profile?.imageUrl,),
          ),
        ),
      );
    }

    return Row(mainAxisSize: MainAxisSize.min, children: children);
  }
}

/// 40r round pill — bg `fill.handleBg`, 1px `border.main`, 24r radius,
/// p=8, 24px SVG tinted `text.primary`.
class _PillIcon extends StatelessWidget {
  const _PillIcon({
    required this.svgAsset,
    required this.onTap,
    required this.colors,
    required this.semanticsLabel,
  });

  final String svgAsset;
  final VoidCallback onTap;
  final PilotColorTheme colors;
  final String semanticsLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: semanticsLabel,
      button: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          padding: EdgeInsets.all(8.r),
          decoration: BoxDecoration(
            color: colors.fill.handleBg,
            border: Border.all(color: colors.border.main),
            borderRadius: BorderRadius.circular(24.r),
          ),
          child: SvgPicture.asset(
            svgAsset,
            width: 24.r,
            height: 24.r,
            colorFilter: ColorFilter.mode(
              colors.text.primary,
              BlendMode.srcIn,
            ),
          ),
        ),
      ),
    );
  }
}

/// Same chrome as [_PillIcon] but adds a live unread-count badge from
/// [UnreadCountService]. Hidden when count is zero. Caps at "99+".
class _PillIconWithBadge extends StatelessWidget {
  const _PillIconWithBadge({
    required this.svgAsset,
    required this.onTap,
    required this.colors,
    required this.semanticsLabel,
  });

  final String svgAsset;
  final VoidCallback onTap;
  final PilotColorTheme colors;
  final String semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final texts = PilotTextTheme.of(context);
    return Semantics(
      label: semanticsLabel,
      button: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              padding: EdgeInsets.all(8.r),
              decoration: BoxDecoration(
                color: colors.fill.handleBg,
                border: Border.all(color: colors.border.main),
                borderRadius: BorderRadius.circular(24.r),
              ),
              child: SvgPicture.asset(
                svgAsset,
                width: 24.r,
                height: 24.r,
                colorFilter: ColorFilter.mode(
                  colors.text.primary,
                  BlendMode.srcIn,
                ),
              ),
            ),
            ValueListenableBuilder<int>(
              valueListenable: getIt<UnreadCountService>().count,
              builder: (_, count, __) {
                if (count == 0) return const SizedBox.shrink();
                // Mirrors Angular ant-badge-count: 16px min, #ef4444 bg,
                // 2px ring against page bg, 10sp / 600.
                return Positioned(
                  top: -4.h,
                  right: -4.w,
                  child: Container(
                    constraints: BoxConstraints(
                      minWidth: 20.r,
                      minHeight: 20.r,
                    ),
                    padding: EdgeInsets.symmetric(horizontal: 6.w),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: colors.error.main,
                      borderRadius: BorderRadius.circular(10.r),
                      border: Border.all(color: colors.bg.layout, width: 2),
                    ),
                    child: Text(
                      count > 99 ? '99+' : '$count',
                      textAlign: TextAlign.center,
                      style: texts.caption.copyWith(
                        color: colors.text.lightSolid,
                        fontSize: 12.sp,
                        height: 1.0,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
