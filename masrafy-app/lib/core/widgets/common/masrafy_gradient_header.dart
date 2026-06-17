import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// Brand gradient hero header (Figma login `77:1032`, signup `91:323`,
/// otp `137:2673`): deep-navy → indigo → azure, bottom-aligned title +
/// subtitle in white. The navy anchor is derived from `primary.active`
/// (darkened) so the whole gradient stays token-driven — no raw hex
/// (Principle VIII / A18). Promoted to `core/widgets/common/` per
/// Principle XXXIII (shared on reuse).
///
/// When [onBack] is supplied a translucent rounded back button is rendered
/// top-start over the gradient (Figma `137:2903`); the title block stays
/// pinned to the bottom regardless, so existing call sites that pass no
/// [onBack] are visually unchanged.
///
/// An optional [bottom] widget renders just under the subtitle, still inside
/// the gradient (used by the questionnaire wizard for its segmented progress
/// bar, Figma `4024:2197`). Default `null` keeps every existing call site
/// (login / signup / otp / home) visually unchanged.
///
/// [collapseProgress] drives a collapsing-on-scroll variant when this header is
/// hosted in [MasrafySliverGradientHeaderDelegate]: 0 = fully expanded, 1 =
/// fully collapsed. As it grows the subtitle (+ [bottom]) fades and yields its
/// space, the title scales down and indents past the glass back button, while
/// the gradient and the pinned back button persist. [heightInPixels], when set,
/// is the painted height verbatim (already `.h`-scaled by the delegate, which
/// works in physical pixels and must not re-apply screenutil scaling); when
/// null it falls back to `height.h`. Both params default to a no-op so every
/// existing call site renders byte-for-byte unchanged.
class MasrafyGradientHeader extends StatelessWidget {
  const MasrafyGradientHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.height = 282,
    this.onBack,
    this.bottom,
    this.collapseProgress = 0,
    this.heightInPixels,
  });

  final String title;
  final String subtitle;
  final double height;
  final VoidCallback? onBack;
  final Widget? bottom;
  final double collapseProgress;
  final double? heightInPixels;

  /// Content-sized expanded height (logical px) for this hero, so callers never
  /// hardcode a fixed height that clips a long title / subtitle / [bottom] bar
  /// (Principle XXXIII gradient-hero rule, A35). Measures the title
  /// (`heading3`, up to 3 lines) + subtitle (`bodySmall`) with a [TextPainter]
  /// at the real available width, mirroring the layout `build` uses:
  /// `top + titleH + 6 + subH + bottomExtent + 36`. [bottomExtent] is the
  /// height of the optional [bottom] widget INCLUDING its leading `Gap(18)`.
  /// Result is floored at [minHeight].
  static double expandedHeightFor(
    BuildContext context, {
    required String title,
    required String subtitle,
    bool hasBack = false,
    double bottomExtent = 0,
    double minHeight = 0,
  }) {
    final media = MediaQuery.of(context);
    final text = MasrafyTextTheme.of(context);
    final maxWidth = media.size.width - 48.w; // 24.w each side
    final dir = Directionality.of(context);

    double measure(String value, TextStyle style) {
      final painter = TextPainter(
        text: TextSpan(text: value, style: style),
        textDirection: dir,
        maxLines: 3,
      )..layout(maxWidth: maxWidth);
      return painter.height;
    }

    final titleH = measure(
      title,
      text.heading3.bold().copyWith(height: 1.25),
    );
    final subH = measure(subtitle, text.bodySmall);
    // When there's a back button, reserve its toolbar band PLUS a clear gap so
    // the (bottom-aligned) title never rides up into / under the back button.
    final top =
        media.viewPadding.top + (hasBack ? kToolbarHeight + 48.h : 8.h);
    final content = top + titleH + 6.h + subH + bottomExtent + 36.h;
    return content < minHeight ? minHeight : content;
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    // Crossfade between the expanded hero (big bottom title + subtitle) and a
    // compact toolbar title that is vertically centred on the back-button row.
    // The fades overlap (0.45..0.56) so there is no blank frame mid-scroll.
    final t = collapseProgress;
    final expandedOpacity = (1 - t * 1.8).clamp(0.0, 1.0);
    final collapsedOpacity = ((t - 0.45) / 0.55).clamp(0.0, 1.0);
    final expandedTitleStyle = text.heading3.bold().copyWith(
          color: colors.white,
          height: 1.25,
        );
    final collapsedTitleStyle = text.heading4.copyWith(color: colors.white);

    return Container(
      width: double.infinity,
      height: heightInPixels ?? height.h,
      padding: EdgeInsetsDirectional.symmetric(horizontal: 24.w),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          stops: const [0, 0.6, 1],
          colors: [
            Color.lerp(colors.primary.active, Colors.black, 0.4)!,
            colors.primary.main,
            colors.secondary.main,
          ],
        ),
      ),
      child: Stack(
        children: [
          // 1. Expanded hero — full-size title + subtitle (+ optional bottom),
          //    bottom-aligned. Fades out as the header collapses.
          if (expandedOpacity > 0)
            Align(
              alignment: AlignmentDirectional.bottomStart,
              child: Padding(
                padding: EdgeInsetsDirectional.only(bottom: 36.h),
                child: Opacity(
                  opacity: expandedOpacity,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: expandedTitleStyle),
                      Gap(6.h),
                      Text(
                        subtitle,
                        style: text.bodySmall.copyWith(
                          color: colors.white.withValues(alpha: 0.55),
                        ),
                      ),
                      if (bottom != null) ...[
                        Gap(18.h),
                        bottom!,
                      ],
                    ],
                  ),
                ),
              ),
            ),
          // 2. Compact toolbar title — smaller font, vertically centred in the
          //    `kToolbarHeight` band that sits just below the status bar, with
          //    a generous start offset so it clears the back button. Fades in
          //    as the header collapses. The band is top-aligned (not bottom),
          //    so the bar's extra height becomes breathing room beneath it.
          if (collapsedOpacity > 0)
            Align(
              alignment: AlignmentDirectional.topStart,
              child: Padding(
                padding: EdgeInsetsDirectional.only(
                  top: MediaQuery.of(context).viewPadding.top,
                ),
                child: Opacity(
                  opacity: collapsedOpacity,
                  child: SizedBox(
                    height: kToolbarHeight,
                    child: Padding(
                      padding: EdgeInsetsDirectional.only(
                        start: onBack != null ? 64.w : 0,
                      ),
                      child: Align(
                        alignment: AlignmentDirectional.centerStart,
                        // FittedBox keeps the WHOLE title visible — it only
                        // scales the font down when the title is too wide for
                        // the toolbar (no ellipsis truncation).
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: AlignmentDirectional.centerStart,
                          child: Text(
                            title,
                            maxLines: 1,
                            style: collapsedTitleStyle,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          // 3. Glass back button — vertically centred in the same toolbar band,
          //    so it shares the title's row at collapse (and reads as top-start
          //    over the big gradient when expanded). The band sits below the
          //    status bar; the bar's extra height keeps it off the bottom edge.
          if (onBack != null)
            Align(
              alignment: AlignmentDirectional.topStart,
              child: Padding(
                padding: EdgeInsetsDirectional.only(
                  top: MediaQuery.of(context).viewPadding.top,
                ),
                child: SizedBox(
                  height: kToolbarHeight,
                  child: Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: _GlassBackButton(onTap: onBack!),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Translucent rounded back affordance over the gradient (Figma `137:2903`).
class _GlassBackButton extends StatelessWidget {
  const _GlassBackButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10.r),
        child: Container(
          padding: EdgeInsets.all(10.r),
          decoration: BoxDecoration(
            color: colors.white.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10.r),
            border: Border.all(color: colors.white.withValues(alpha: 0.15)),
          ),
          child: Icon(
            Icons.arrow_back_rounded,
            size: 24.r,
            color: colors.white,
          ),
        ),
      ),
    );
  }
}
