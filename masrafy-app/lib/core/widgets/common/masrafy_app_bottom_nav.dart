import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/utils/masrafy_assets.dart';

/// The three customer-app tabs.
enum MasrafyAppNavTab { loans, home, menu }

const _switchDuration = Duration(milliseconds: 200);
const _pressDuration = Duration(milliseconds: 120);

/// Customer-app bottom navigation — My Loans / Home / Menu. Shared by the home
/// + account + profile screens (Principle XXXIII). Matches Figma `4138:162`.
///
/// White bar, no top border, tabs bottom-aligned. The **active** tab's glyph is
/// wrapped in a raised 45px circle (filled `primary.main`, white ring, soft
/// shadow) with its label hidden; the others show a bare `primary.main` glyph
/// with a `primary.main` label. The circle + label-hide follow [active], so the
/// selected treatment moves with whichever tab is current. Each tap fires
/// `HapticFeedback.selectionClick()`; the host wires callbacks.
class MasrafyAppBottomNav extends StatelessWidget {
  const MasrafyAppBottomNav({
    super.key,
    required this.active,
    required this.loansLabel,
    required this.homeLabel,
    required this.menuLabel,
    this.onLoans,
    this.onHome,
    this.onMenu,
  });

  final MasrafyAppNavTab active;
  final String loansLabel;
  final String homeLabel;
  final String menuLabel;
  final VoidCallback? onLoans;
  final VoidCallback? onHome;
  final VoidCallback? onMenu;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);

    return Container(
      color: colors.bg.container,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsetsDirectional.symmetric(horizontal: 12.w, vertical: 5.h),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: _NavTab(
                  asset: MasrafyAssets.kNavLoans,
                  label: loansLabel,
                  isActive: active == MasrafyAppNavTab.loans,
                  onTap: onLoans,
                ),
              ),
              Expanded(
                child: _NavTab(
                  asset: MasrafyAssets.kNavHomeFilled,
                  label: homeLabel,
                  isActive: active == MasrafyAppNavTab.home,
                  onTap: onHome,
                ),
              ),
              Expanded(
                child: _NavTab(
                  asset: MasrafyAssets.kNavAccount,
                  label: menuLabel,
                  isActive: active == MasrafyAppNavTab.menu,
                  onTap: onMenu,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One tab. **Active** → glyph inside a raised 45px circle (white-tinted glyph,
/// `primary.main` fill, white ring, soft shadow), label hidden. **Inactive** →
/// bare `primary.main` glyph + `primary.main` label. The active/inactive morph
/// is animated; local [_pressed] drives a light tap bounce.
class _NavTab extends StatefulWidget {
  const _NavTab({
    required this.asset,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  final String asset;
  final String label;
  final bool isActive;
  final VoidCallback? onTap;

  @override
  State<_NavTab> createState() => _NavTabState();
}

class _NavTabState extends State<_NavTab> {
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

    final glyphColor = isActive ? colors.bg.container : colors.primary.main;
    final glyphSize = isActive ? 20.r : 24.r;
    final glyph = SvgPicture.asset(
      widget.asset,
      width: glyphSize,
      height: glyphSize,
      colorFilter: ColorFilter.mode(glyphColor, BlendMode.srcIn),
    );

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
          scale: _pressed ? 0.92 : 1,
          duration: _pressDuration,
          curve: Curves.easeOut,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedContainer(
                duration: _switchDuration,
                curve: Curves.easeOut,
                // border 4 + padding ~8.5 + glyph 20 ≈ 45px outer (Figma).
                padding: EdgeInsets.all(isActive ? 8.5.r : 0),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isActive ? colors.primary.main : Colors.transparent,
                  border: isActive
                      ? Border.all(color: colors.bg.container, width: 4.r)
                      : null,
                  boxShadow: isActive
                      ? [
                          BoxShadow(
                            color: colors.primary.hover.withValues(alpha: 0.2),
                            offset: Offset(0, 5.h),
                            blurRadius: 5.r,
                          ),
                        ]
                      : null,
                ),
                child: glyph,
              ),
              // Label hidden on the active tab; collapses as the circle grows.
              AnimatedSize(
                duration: _switchDuration,
                curve: Curves.easeOut,
                child: isActive
                    ? const SizedBox.shrink()
                    : Padding(
                        padding: EdgeInsetsDirectional.only(top: 2.h),
                        child: Text(
                          widget.label,
                          maxLines: 1,
                          style: text.caption.copyWith(
                            fontSize: 10.sp,
                            color: colors.primary.main,
                          ),
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
