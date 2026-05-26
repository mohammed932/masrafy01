import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/utils/pilot_assets.dart';
import 'package:app/core/utils/responsive.dart';

enum PilotNavTab {
  dashboard,
  studyPlanner,
  test,
  reports,
  eshop;

  static PilotNavTab? fromIndex(int index) =>
      index >= 0 && index < PilotNavTab.values.length
          ? PilotNavTab.values[index]
          : null;
}

/// Pill-shaped bottom navigation. Bar height stays fixed; only the
/// active pill widens to host its label. Color, border, and width
/// morph through a single eased curve so the switch reads as one
/// continuous motion rather than discrete frames.
class PilotBottomNavBar extends StatelessWidget {
  const PilotBottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onTabSelected,
  });

  final int currentIndex;
  final ValueChanged<int> onTabSelected;

  static const _duration = Duration(milliseconds: 320);
  static const _curve = Curves.easeOutCubic;

  static const _tabs = [
    _NavTab(svgAsset: PilotAssets.kNavHome, label: 'Dashboard'),
    _NavTab(svgAsset: PilotAssets.kNavStudyPlanner, label: 'Study Planner'),
    _NavTab(svgAsset: PilotAssets.kNavTests, label: 'Test'),
    _NavTab(svgAsset: PilotAssets.kNavReports, label: 'Reports'),
    _NavTab(svgAsset: PilotAssets.kNavEshop, label: 'E-Shop'),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);

    final isTablet = Responsive.isTablet(context);
    final bar = Container(
      height: 68.r,
      padding: EdgeInsets.symmetric(horizontal: 8.w),
      decoration: BoxDecoration(
        color: colors.bg.layout,
        border: Border.all(color: colors.border.main),
        borderRadius: BorderRadius.circular(54.r),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: _tabs
            .mapIndexed(
              (i, tab) => _NavItem(
                tab: tab,
                isActive: i == currentIndex,
                onTap: () {
                  HapticFeedback.selectionClick();
                  onTabSelected(i);
                },
                duration: _duration,
                curve: _curve,
              ),
            )
            .toList(),
      ),
    );
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(24.w, 8.h, 24.w, 12.h),
        child: isTablet
            ? Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 480),
                    child: SizedBox(width: 480, child: bar),
                  ),
                ],
              )
            : bar,
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.tab,
    required this.isActive,
    required this.onTap,
    required this.duration,
    required this.curve,
  });

  final _NavTab tab;
  final bool isActive;
  final VoidCallback onTap;
  final Duration duration;
  final Curve curve;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final text = PilotTextTheme.of(context);
    final iconColor = isActive ? Colors.white : colors.icon.main;

    return Semantics(
      label: tab.label,
      button: true,
      selected: isActive,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: duration,
          curve: curve,
          height: 44.r,
          padding: EdgeInsets.symmetric(horizontal: 12.r),
          decoration: BoxDecoration(
            color: isActive ? colors.primary.main : colors.fill.alterSolid,
            border: Border.all(
              color: isActive ? colors.primary.hover : colors.border.main,
            ),
            borderRadius: BorderRadius.circular(24.r),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedSwitcher(
                duration: duration,
                switchInCurve: curve,
                switchOutCurve: curve,
                transitionBuilder: (child, anim) => FadeTransition(
                  opacity: anim,
                  child: child,
                ),
                child: SvgPicture.asset(
                  tab.svgAsset,
                  key: ValueKey('${tab.label}-$isActive'),
                  width: 20.r,
                  height: 20.r,
                  colorFilter: ColorFilter.mode(iconColor, BlendMode.srcIn),
                ),
              ),
              ClipRect(
                child: AnimatedSize(
                  duration: duration,
                  curve: curve,
                  alignment: Alignment.centerLeft,
                  child: isActive
                      ? Padding(
                          padding: EdgeInsets.only(left: 8.w),
                          child: AnimatedOpacity(
                            duration: duration,
                            curve: curve,
                            opacity: 1,
                            child: Text(
                              tab.label,
                              style: text.bodySmall.regular().copyWith(
                                    color: iconColor,
                                  ),
                              maxLines: 1,
                              softWrap: false,
                              overflow: TextOverflow.clip,
                            ),
                          ),
                        )
                      : const SizedBox.shrink(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavTab {
  const _NavTab({required this.svgAsset, required this.label});

  final String svgAsset;
  final String label;
}

/// Vertical iPad-side navigation rail. Mirrors [PilotBottomNavBar]'s pill
/// style — same icons, same active treatment — but stacked vertically with
/// the label always visible on the active pill.
class PilotNavigationRail extends StatelessWidget {
  const PilotNavigationRail({
    super.key,
    required this.currentIndex,
    required this.onTabSelected,
  });

  final int currentIndex;
  final ValueChanged<int> onTabSelected;

  static const _duration = Duration(milliseconds: 320);
  static const _curve = Curves.easeOutCubic;
  static const double railWidth = 96;

  /// Anchor for the Test rail pill so popovers like `TestNavMenu` can pin
  /// themselves to the right of it on tablets.
  static final GlobalKey testItemKey = GlobalKey(debugLabel: 'rail-test');

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    return SafeArea(
      right: false,
      child: Container(
        width: railWidth,
        padding: EdgeInsets.symmetric(vertical: 16.h, horizontal: 8.w),
        decoration: BoxDecoration(
          color: colors.bg.layout,
          border: Border(right: BorderSide(color: colors.border.main)),
        ),
        child: Column(
          children: [
            for (var i = 0; i < PilotBottomNavBar._tabs.length; i++) ...[
              _RailItem(
                key: i == 2 ? testItemKey : null,
                tab: PilotBottomNavBar._tabs[i],
                isActive: i == currentIndex,
                onTap: () {
                  HapticFeedback.selectionClick();
                  onTabSelected(i);
                },
                duration: _duration,
                curve: _curve,
              ),
              if (i < PilotBottomNavBar._tabs.length - 1) SizedBox(height: 12.h),
            ],
          ],
        ),
      ),
    );
  }
}

class _RailItem extends StatelessWidget {
  const _RailItem({
    super.key,
    required this.tab,
    required this.isActive,
    required this.onTap,
    required this.duration,
    required this.curve,
  });

  final _NavTab tab;
  final bool isActive;
  final VoidCallback onTap;
  final Duration duration;
  final Curve curve;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final text = PilotTextTheme.of(context);
    final iconColor = isActive ? Colors.white : colors.icon.main;
    final labelColor = isActive ? Colors.white : colors.text.primary;

    return Semantics(
      label: tab.label,
      button: true,
      selected: isActive,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: duration,
          curve: curve,
          width: double.infinity,
          padding: EdgeInsets.symmetric(vertical: 10.h, horizontal: 8.w),
          decoration: BoxDecoration(
            color: isActive ? colors.primary.main : colors.fill.alterSolid,
            border: Border.all(
              color: isActive ? colors.primary.hover : colors.border.main,
            ),
            borderRadius: BorderRadius.circular(16.r),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SvgPicture.asset(
                tab.svgAsset,
                width: 22.r,
                height: 22.r,
                colorFilter: ColorFilter.mode(iconColor, BlendMode.srcIn),
              ),
              SizedBox(height: 4.h),
              Text(
                tab.label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: text.bodySmall.regular().copyWith(
                      color: labelColor,
                      fontSize: 10.sp,
                      height: 14 / 10,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Drop-in [Scaffold] replacement that puts the nav on the side as a
/// [PilotNavigationRail] on tablets, or at the bottom as a
/// [PilotBottomNavBar] on phones. Use for every root tab screen.
class PilotNavScaffold extends StatelessWidget {
  const PilotNavScaffold({
    super.key,
    required this.body,
    required this.currentIndex,
    required this.onTabSelected,
    this.appBar,
    this.endDrawer,
    this.backgroundColor,
    this.floatingActionButton,
    this.scaffoldKey,
  });

  final Widget body;
  final int currentIndex;
  final ValueChanged<int> onTabSelected;
  final PreferredSizeWidget? appBar;
  final Widget? endDrawer;
  final Color? backgroundColor;
  final Widget? floatingActionButton;
  final GlobalKey<ScaffoldState>? scaffoldKey;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: scaffoldKey,
      backgroundColor: backgroundColor,
      appBar: appBar,
      endDrawer: endDrawer,
      body: body,
      bottomNavigationBar: PilotBottomNavBar(
        currentIndex: currentIndex,
        onTabSelected: onTabSelected,
      ),
      floatingActionButton: floatingActionButton,
    );
  }
}
