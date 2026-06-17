import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// The three customer-app tabs (Figma `137:2976`).
enum MasrafyAppNavTab { loans, home, menu }

/// Shared motion language for the bar — matches [MasrafyBottomNavBar] so every
/// nav surface animates with one continuous, eased feel.
const _navDuration = Duration(milliseconds: 320);
const _navCurve = Curves.easeOutCubic;
const _pressDuration = Duration(milliseconds: 120);

/// Customer-app bottom navigation — My Loans / Home (raised gradient circle) /
/// Menu. Shared by the home + account + profile screens (Principle XXXIII).
///
/// Premium + animated: the bar floats as a rounded sheet with a soft upward
/// lift shadow; side tabs grow a Material-3 indicator pill behind the icon
/// (outline → filled cross-fade, label morphing colour + weight); the centre
/// Home button carries the brand azure→indigo gradient with a glow and bounces
/// on press. Every tap fires `HapticFeedback.selectionClick()`. Each item's tap
/// is wired by the host screen.
class MasrafyAppBottomNav extends StatelessWidget {
  const MasrafyAppBottomNav({
    super.key,
    required this.active,
    required this.loansLabel,
    required this.menuLabel,
    this.onLoans,
    this.onHome,
    this.onMenu,
  });

  final MasrafyAppNavTab active;
  final String loansLabel;
  final String menuLabel;
  final VoidCallback? onLoans;
  final VoidCallback? onHome;
  final VoidCallback? onMenu;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);

    return Container(
      decoration: BoxDecoration(
        color: colors.bg.container,
        borderRadius: BorderRadiusDirectional.only(
          topStart: Radius.circular(24.r),
          topEnd: Radius.circular(24.r),
        ),
        boxShadow: [
          BoxShadow(
            color: colors.textBase.withValues(alpha: 0.08),
            blurRadius: 24,
            offset: const Offset(0, -8),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsetsDirectional.only(top: 2.h, bottom: 2.h),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _NavSideItem(
                outlineIcon: Icons.favorite_border,
                filledIcon: Icons.favorite,
                label: loansLabel,
                isActive: active == MasrafyAppNavTab.loans,
                onTap: onLoans,
              ),
              _HomeFab(onTap: onHome),
              _NavSideItem(
                outlineIcon: Icons.person_outline,
                filledIcon: Icons.person,
                label: menuLabel,
                isActive: active == MasrafyAppNavTab.menu,
                onTap: onMenu,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A side tab (My Loans / Menu): a pill indicator fades + grows behind the
/// icon when active, the glyph cross-fades outline → filled, and the label
/// morphs colour + weight. Local [_pressed] state drives the tap bounce.
class _NavSideItem extends StatefulWidget {
  const _NavSideItem({
    required this.outlineIcon,
    required this.filledIcon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  final IconData outlineIcon;
  final IconData filledIcon;
  final String label;
  final bool isActive;
  final VoidCallback? onTap;

  @override
  State<_NavSideItem> createState() => _NavSideItemState();
}

class _NavSideItemState extends State<_NavSideItem> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed != value) setState(() => _pressed = value);
  }

  void _handleTap() {
    HapticFeedback.selectionClick();
    widget.onTap?.call();
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final isActive = widget.isActive;
    final activeColor = colors.primary.main;
    final idleColor = colors.icon.main;

    return Semantics(
      button: true,
      selected: isActive,
      label: widget.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _handleTap,
        onTapDown: (_) => _setPressed(true),
        onTapUp: (_) => _setPressed(false),
        onTapCancel: () => _setPressed(false),
        child: AnimatedScale(
          scale: _pressed ? 0.90 : 1,
          duration: _pressDuration,
          curve: Curves.easeOut,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedContainer(
                duration: _navDuration,
                curve: _navCurve,
                padding: EdgeInsets.symmetric(
                  horizontal: isActive ? 18.w : 12.w,
                  vertical: 2.h,
                ),
                decoration: BoxDecoration(
                  color: isActive ? colors.primary.bg : Colors.transparent,
                  borderRadius: BorderRadius.circular(16.r),
                ),
                child: AnimatedSwitcher(
                  duration: _navDuration,
                  switchInCurve: _navCurve,
                  switchOutCurve: _navCurve,
                  transitionBuilder: (child, anim) =>
                      FadeTransition(opacity: anim, child: child),
                  child: Icon(
                    isActive ? widget.filledIcon : widget.outlineIcon,
                    key: ValueKey(isActive),
                    size: 22.r,
                    color: isActive ? activeColor : idleColor,
                  ),
                ),
              ),
              Gap(1.h),
              AnimatedDefaultTextStyle(
                duration: _navDuration,
                curve: _navCurve,
                style: (isActive
                        ? text.caption.semiBold()
                        : text.caption.regular())
                    .copyWith(color: isActive ? activeColor : idleColor),
                child: Text(widget.label),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The raised centre Home button — brand azure→indigo gradient, azure glow, a
/// white ring punching it through the bar, and a press bounce.
class _HomeFab extends StatefulWidget {
  const _HomeFab({required this.onTap});

  final VoidCallback? onTap;

  @override
  State<_HomeFab> createState() => _HomeFabState();
}

class _HomeFabState extends State<_HomeFab> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed != value) setState(() => _pressed = value);
  }

  void _handleTap() {
    HapticFeedback.selectionClick();
    widget.onTap?.call();
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);

    return Semantics(
      button: true,
      label: 'Home',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _handleTap,
        onTapDown: (_) => _setPressed(true),
        onTapUp: (_) => _setPressed(false),
        onTapCancel: () => _setPressed(false),
        child: Transform.translate(
          offset: Offset(0, -12.h),
          child: AnimatedScale(
            scale: _pressed ? 0.92 : 1,
            duration: _pressDuration,
            curve: Curves.easeOut,
            child: Container(
              width: 52.r,
              height: 52.r,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: AlignmentDirectional.topStart,
                  end: AlignmentDirectional.bottomEnd,
                  colors: [colors.secondary.main, colors.primary.main],
                ),
                border: Border.all(color: colors.white, width: 4),
                boxShadow: [
                  BoxShadow(
                    color: colors.secondary.main.withValues(alpha: 0.4),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Icon(Icons.home_rounded, color: colors.white, size: 24.r),
            ),
          ),
        ),
      ),
    );
  }
}
