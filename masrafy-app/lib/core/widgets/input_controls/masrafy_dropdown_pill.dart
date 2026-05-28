import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/utils/masrafy_assets.dart';

/// Pill-shaped dropdown trigger — used for the "Weekly ⌄" period selector
/// and the "Subjects / Mode / Filters" filter row pills.
///
/// Pixel-perfect implementation of Figma's "Dropdown / Dropdown Button Basic"
/// component (instances 3388:61250, 3388:61491, 3388:61492, 3388:61493).
///
/// Two visual variants:
/// - Default (neutral): `fill.handleBg` background + `border.main` border —
///   the filter-row pills.
/// - [isPrimary] = true: `primary.bgHover` background + `primary.borderHover`
///   border — the leaderboard period selector (Figma node 3251:44127).
class MasrafyDropdownPill extends StatelessWidget {
  const MasrafyDropdownPill({
    super.key,
    required this.label,
    this.onTap,
    this.isPrimary = false,
  });

  final String label;
  // Optional so the pill can be wrapped by a parent gesture handler
  // (e.g. MasrafyPopupMenu's PopupMenuButton). When null, the inner
  // GestureDetector is skipped and taps fall through to the parent.
  final VoidCallback? onTap;

  /// When true, renders the primary-tinted variant per Figma node 3251:44127.
  final bool isPrimary;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    final bg = isPrimary ? colors.primary.bgHover : colors.fill.handleBg;
    final border =
        isPrimary ? colors.primary.borderHover : colors.border.main;

    final pill = Container(
      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(24.r),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: texts.body.copyWith(color: colors.text.heading),
          ),
          SizedBox(width: 8.w),
          SizedBox(
            width: 16.r,
            height: 16.r,
            child: SvgPicture.asset(
              MasrafyAssets.kChevronDown,
              colorFilter: ColorFilter.mode(
                colors.text.heading,
                BlendMode.srcIn,
              ),
            ),
          ),
        ],
      ),
    );

    if (onTap == null) return pill;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: pill,
    );
  }
}
