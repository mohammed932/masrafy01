import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';

// ── Abstract base ────────────────────────────────────────────────────────────
// Owns the shared layout. Concrete subclasses supply content via overrides.

abstract class PilotEmptyState extends StatelessWidget {
  const PilotEmptyState({super.key});

  /// Material icon used when [iconSvgAsset] is null.
  IconData get icon;

  /// Optional SVG asset path. When non-null, renders an
  /// [SvgPicture.asset] instead of [icon] — preferred for new callers
  /// per the "no Material Icons" rule.
  String? get iconSvgAsset => null;

  String get title;
  String get body;
  String? get actionLabel => null;
  VoidCallback? get onAction => null;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 32.w),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            iconSvgAsset != null
                ? SvgPicture.asset(
                    iconSvgAsset!,
                    width: 48.r,
                    height: 48.r,
                    colorFilter: ColorFilter.mode(
                      colors.text.secondary,
                      BlendMode.srcIn,
                    ),
                  )
                : Icon(icon, size: 48.r, color: colors.text.secondary),
            Gap(16.h),
            Text(
              title,
              style: texts.bodyLarge.semiBold(),
              textAlign: TextAlign.center,
            ),
            Gap(8.h),
            Text(
              body,
              style: texts.body.copyWith(color: colors.text.secondary),
              textAlign: TextAlign.center,
            ),
            if (actionLabel != null && onAction != null) ...[
              Gap(24.h),
              FilledButton(
                onPressed: onAction,
                style: FilledButton.styleFrom(
                  backgroundColor: colors.primary.main,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24.r),
                  ),
                  padding:
                      EdgeInsets.symmetric(horizontal: 24.w, vertical: 12.h),
                ),
                child: Text(actionLabel!, style: texts.body),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Concrete variants ────────────────────────────────────────────────────────

/// Network / fetch failure. Standardised copy — only the retry callback varies.
class PilotFetchErrorState extends PilotEmptyState {
  const PilotFetchErrorState({super.key, required this.onRetry});

  final VoidCallback onRetry;

  @override
  IconData get icon => Icons.wifi_off_outlined;

  @override
  String get title => "Couldn't load data";

  @override
  String get body => 'Please check your connection and try again.';

  @override
  String get actionLabel => 'Retry';

  @override
  VoidCallback get onAction => onRetry;
}

/// Empty list — no items exist yet. Icon, title, body and optional action
/// are all caller-specified because the copy is feature-specific.
///
/// Pass either [icon] (Material) or [iconSvgAsset] (preferred — SVG path
/// from `PilotAssets`). When both are passed, SVG wins.
class PilotNoItemsState extends PilotEmptyState {
  const PilotNoItemsState({
    super.key,
    IconData? icon,
    String? iconSvgAsset,
    required String title,
    required String body,
    String? actionLabel,
    VoidCallback? onAction,
  })  : assert(
          icon != null || iconSvgAsset != null,
          'PilotNoItemsState needs either an `icon` or `iconSvgAsset`',
        ),
        _icon = icon,
        _iconSvgAsset = iconSvgAsset,
        _title = title,
        _body = body,
        _actionLabel = actionLabel,
        _onAction = onAction;

  final IconData? _icon;
  final String? _iconSvgAsset;
  final String _title;
  final String _body;
  final String? _actionLabel;
  final VoidCallback? _onAction;

  @override
  IconData get icon => _icon ?? Icons.inbox_outlined;

  @override
  String? get iconSvgAsset => _iconSvgAsset;

  @override
  String get title => _title;

  @override
  String get body => _body;

  @override
  String? get actionLabel => _actionLabel;

  @override
  VoidCallback? get onAction => _onAction;
}

/// Empty filtered list — items exist but none match the active filters.
/// Standardised copy; only the clear-filters callback varies.
class PilotNoResultsState extends PilotEmptyState {
  const PilotNoResultsState({super.key, required this.onClearFilters});

  final VoidCallback onClearFilters;

  @override
  IconData get icon => Icons.search_off_outlined;

  @override
  String get title => 'No results match your filters';

  @override
  String get body => 'Try clearing your filters to see more.';

  @override
  String get actionLabel => 'Clear Filters';

  @override
  VoidCallback get onAction => onClearFilters;
}
