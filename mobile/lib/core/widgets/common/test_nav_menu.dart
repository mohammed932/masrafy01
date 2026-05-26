import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:gap/gap.dart';
import 'package:app/core/router/router.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/utils/pilot_assets.dart';

/// Popover menu shown above the bottom-nav "Test" tab. Mirrors Figma
/// frame `4086:62227` — three options (New Test, Saved Tests, Shared
/// Tests) inside a 160w-wide dark pill that floats just above the
/// bottom navigation bar.
///
/// The last-selected option is remembered in-memory across the app
/// session via [selectedIndex] so reopening the menu shows the
/// previous choice as the active item (same UX pattern as Material's
/// `PopupMenuButton.initialValue`). Defaults to "New Test" on cold
/// start; intentionally not persisted to disk — this is a UX
/// convenience, not a setting.
class TestNavMenu {
  TestNavMenu._();

  /// Index of the option highlighted on next open. Updated when the
  /// user picks an item (success path of [show]).
  static int selectedIndex = 0;

  /// Opens the popover. Returns when the user picks an item or
  /// dismisses (taps outside / back-gestures). Navigation to the
  /// chosen route is performed here so callers don't have to map
  /// sub-indexes themselves.
  static Future<void> show(BuildContext context) async {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);

    final picked = await showGeneralDialog<int>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Dismiss test menu',
      barrierColor: Colors.transparent,
      transitionDuration: const Duration(milliseconds: 160),
      pageBuilder: (_, __, ___) => const SizedBox.shrink(),
      transitionBuilder: (ctx, anim, ___, ____) {
        final fade = CurvedAnimation(parent: anim, curve: Curves.easeOut);
        final scale = Tween<double>(begin: 0.96, end: 1.0).animate(fade);
        return FadeTransition(
          opacity: fade,
          child: ScaleTransition(
            alignment: Alignment.bottomCenter,
            scale: scale,
            child: Align(
              alignment: Alignment.bottomCenter,
              child: Padding(
                // Lift above the pill-shaped bottom nav. Bottom-nav
                // height ≈ 12 (top pad) + 12 (inner v-pad) + 44 (tab)
                // + 12 (inner v-pad) + 12 (bottom pad) ≈ 92, plus safe
                // area inset and a few px of breathing room above the
                // bar so the menu doesn't sit flush against it.
                padding: EdgeInsets.only(
                  bottom:
                      MediaQuery.viewPaddingOf(ctx).bottom + 96.h,
                ),
                child: _MenuPill(colors: colors, texts: texts),
              ),
            ),
          ),
        );
      },
    );

    if (picked == null) return;
    selectedIndex = picked;

    // Navigation runs after the dialog closes so the route push
    // doesn't compete with the dismiss animation.
    if (!context.mounted) return;

    // Swap-replace when toggling laterally between Saved Tests and
    // Shared Tests (they're sibling destinations from the user's
    // mental model, so each replaces the other on the stack rather
    // than piling up). Tapping the option you're already on is a
    // no-op. Other cases push so the back gesture returns to the
    // entry screen.
    final currentName = context.router.current.name;
    final isOnSaved = currentName == SavedTestsRoute.name;
    final isOnShared = currentName == SharedTestsRoute.name;

    switch (picked) {
      case 0:
        await context.router.push(SetStudyRoute());
      case 1:
        if (isOnSaved) return;
        if (isOnShared) {
          await context.router.replace(const SavedTestsRoute());
        } else {
          await context.router.push(const SavedTestsRoute());
        }
      case 2:
        if (isOnShared) return;
        if (isOnSaved) {
          await context.router.replace(const SharedTestsRoute());
        } else {
          await context.router.push(const SharedTestsRoute());
        }
    }
  }
}

class _MenuPill extends StatelessWidget {
  const _MenuPill({required this.colors, required this.texts});

  final PilotColorTheme colors;
  final PilotTextTheme texts;

  @override
  Widget build(BuildContext context) {
    return Material(
      type: MaterialType.transparency,
      child: Container(
        width: 160.w,
        padding: EdgeInsets.all(4.r),
        decoration: BoxDecoration(
          // Figma `components/menu/component/popupbg` — `bg.elevated`
          // resolves to the same `#1F1F1F` in dark mode and to white
          // in light mode (theme-correct fallback).
          color: colors.bg.elevated,
          borderRadius: BorderRadius.circular(16.r),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              offset: const Offset(0, 6),
              blurRadius: 16,
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.12),
              offset: const Offset(0, 3),
              blurRadius: 6,
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              offset: const Offset(0, 9),
              blurRadius: 28,
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < _options.length; i++) ...[
              _MenuItem(
                option: _options[i],
                isSelected: i == TestNavMenu.selectedIndex,
                onTap: () => Navigator.of(context).pop<int>(i),
                colors: colors,
                texts: texts,
              ),
              if (i < _options.length - 1) Gap(4.h),
            ],
          ],
        ),
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  const _MenuItem({
    required this.option,
    required this.isSelected,
    required this.onTap,
    required this.colors,
    required this.texts,
  });

  final _Option option;
  final bool isSelected;
  final VoidCallback onTap;
  final PilotColorTheme colors;
  final PilotTextTheme texts;

  @override
  Widget build(BuildContext context) {
    final fg = isSelected ? colors.primary.main : colors.text.primary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16.r),
      child: Container(
        height: 40.h,
        padding: EdgeInsets.symmetric(horizontal: 16.w),
        decoration: BoxDecoration(
          // Figma `itemselectedbg` = `primary.bg` (#0E2225 in dark).
          color: isSelected ? colors.primary.bg : Colors.transparent,
          borderRadius: BorderRadius.circular(16.r),
        ),
        child: Row(
          children: [
            SvgPicture.asset(
              option.iconAsset,
              width: 14.r,
              height: 14.r,
              colorFilter: ColorFilter.mode(fg, BlendMode.srcIn),
            ),
            Gap(10.w),
            Expanded(
              child: Text(
                option.label,
                style: texts.body.copyWith(
                  color: fg,
                  fontSize: 14.sp,
                  height: 22 / 14,
                ),
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Option {
  const _Option({required this.label, required this.iconAsset});
  final String label;
  final String iconAsset;
}

const List<_Option> _options = [
  _Option(label: 'New Test', iconAsset: PilotAssets.kNavTestNew),
  _Option(label: 'Saved Tests', iconAsset: PilotAssets.kNavTestSaved),
  _Option(label: 'Shared Tests', iconAsset: PilotAssets.kShare),
];
