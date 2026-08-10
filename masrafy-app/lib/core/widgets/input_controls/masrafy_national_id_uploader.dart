import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/features/id_capture/id_frame_geometry.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// National-ID document capture (Figma `91:491`): an uppercase section label
/// with an eligibility hint over two upload cards (front / back). UI-only —
/// [onTapFront] / [onTapBack] open the framed camera page from the caller and
/// the caller's cubit performs the upload.
///
/// Promoted to `core/widgets/input_controls/` per Principle XXXIII (shared by
/// signup + profile).
class MasrafyNationalIdUploader extends StatelessWidget {
  const MasrafyNationalIdUploader({
    super.key,
    this.sectionLabel,
    this.sectionHint,
    required this.frontLabel,
    required this.backLabel,
    required this.frontSubtitle,
    required this.backSubtitle,
    this.frontUploaded = false,
    this.backUploaded = false,
    this.frontChecking = false,
    this.backChecking = false,
    this.unavailableSubtitle,
    this.frontImage,
    this.backImage,
    this.onTapFront,
    this.onTapBack,
    this.trailing,
  });

  /// Section heading over the pair. Both are optional: a caller that already
  /// renders its own section header (e.g. the profile editor's form sections)
  /// passes neither, so the pair does not carry two competing headings.
  final String? sectionLabel;
  final String? sectionHint;
  final String frontLabel;
  final String backLabel;
  final String frontSubtitle;
  final String backSubtitle;
  final bool frontUploaded;
  final bool backUploaded;

  /// The side's stored state is still being fetched. Holds the tile neutral so
  /// a side that turns out to be on file never flashes the missing treatment
  /// on the way there.
  final bool frontChecking;
  final bool backChecking;

  /// Shown on a side the server reports as stored but whose picture will not
  /// load — that side renders as missing, so its subtitle must ask for the
  /// upload again rather than keep claiming "Uploaded".
  final String? unavailableSubtitle;

  /// Thumbnail of the captured/stored side, when one is available. Callers pass
  /// a `MemoryImage` right after capture (no round-trip) and a
  /// `CachedNetworkImageProvider` over the presigned URL afterwards, so the
  /// tile looks the same before and after a restart. Null falls back to the
  /// icon — a tile must still render when only the flag is known.
  final ImageProvider? frontImage;
  final ImageProvider? backImage;

  final VoidCallback? onTapFront;
  final VoidCallback? onTapBack;

  /// Optional status affordance pinned to the end of the section-label row
  /// (e.g. a "Uploaded" badge once both sides are on file). A pair-level verdict
  /// belongs beside the pair's heading; per-tile copy can only speak for one
  /// side. Default `null` leaves every existing call site unchanged.
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (sectionLabel != null || trailing != null) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 6.w,
                  children: [
                    if (sectionLabel != null)
                      Text(
                        sectionLabel!.toUpperCase(),
                        style: text.caption.semiBold().copyWith(
                              color: colors.primary.main,
                              letterSpacing: 0.66,
                            ),
                      ),
                    if (sectionHint != null)
                      Text(
                        sectionHint!,
                        style: text.caption
                            .regular()
                            .copyWith(color: colors.text.placeholder),
                      ),
                  ],
                ),
              ),
              if (trailing != null) ...[
                Gap(8.w),
                trailing!,
              ],
            ],
          ),
          Gap(8.h),
        ],
        // Both sides are one control, so the tiles read as a matched pair:
        // `Expanded` equalises width and each card derives its height from that
        // width alone, so the two line up without an `IntrinsicHeight` pass and
        // a two-line placeholder subtitle can no longer outgrow the preview
        // beside it.
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _IdCard(
                label: frontLabel,
                subtitle: frontSubtitle,
                uploaded: frontUploaded,
                checking: frontChecking,
                unavailableSubtitle: unavailableSubtitle,
                image: frontImage,
                onTap: onTapFront,
              ),
            ),
            Gap(10.w),
            Expanded(
              child: _IdCard(
                label: backLabel,
                subtitle: backSubtitle,
                uploaded: backUploaded,
                checking: backChecking,
                unavailableSubtitle: unavailableSubtitle,
                image: backImage,
                onTap: onTapBack,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _IdCard extends StatefulWidget {
  const _IdCard({
    required this.label,
    required this.subtitle,
    required this.uploaded,
    required this.checking,
    this.unavailableSubtitle,
    this.image,
    this.onTap,
  });

  final String label;
  final String subtitle;
  final bool uploaded;
  final bool checking;

  /// Copy for a side the server calls stored but whose picture will not load.
  /// Falls back to [subtitle] when a caller has nothing better to say.
  final String? unavailableSubtitle;
  final ImageProvider? image;
  final VoidCallback? onTap;

  @override
  State<_IdCard> createState() => _IdCardState();
}

class _IdCardState extends State<_IdCard> {
  /// The provider handed in resolved to an error (dead presigned URL, object
  /// never written, offline). Latched per provider so one failed decode does
  /// not re-trigger every rebuild.
  bool _previewFailed = false;

  @override
  void didUpdateWidget(_IdCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A new provider is a new attempt — a fresh capture must not inherit the
    // previous URL's failure.
    if (oldWidget.image != widget.image) _previewFailed = false;
  }

  void _onPreviewFailed() {
    if (_previewFailed) return;
    // The failure surfaces during the image's build; flipping state has to wait
    // for the frame to finish.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _previewFailed = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final preview = _previewFailed ? null : widget.image;
    final checking = widget.checking;
    // A side counts as on file only when its picture is actually on screen.
    // The flag alone is not evidence: the server can report a stored document
    // whose object is gone, and a green tick there sends the customer to the
    // offer gate believing they are done. No renderable picture = missing.
    final missing = !checking && preview == null;
    final onFile = preview != null && widget.uploaded;
    // Three states, one anatomy: on file (success), captured but not yet stored
    // (neutral — a shot mid-upload must not read as an error), and missing.
    // A missing side blocks the loan, so it carries the full error treatment
    // rather than looking like an optional extra.
    final tone = missing
        ? colors.error
        : onFile
            ? colors.success
            : colors.secondary;
    final accent = tone.main;
    final label = widget.label;

    return LayoutBuilder(
      builder: (context, constraints) {
        // The capture page crops every shot to ID-1 (85.60 × 53.98 mm), so the
        // tile carries that exact ratio: a card shaped like the document shows
        // the whole document. The old fixed 72.h let the tile run ~2.7:1 wide,
        // and `BoxFit.cover` then sliced the top and bottom off the very
        // rectangle the user had just lined up in the camera frame.
        // Floored, so a narrow phone cannot squeeze the placeholder's icon
        // plate and its two lines of copy into a sliver.
        final height = math.max(
          constraints.maxWidth / idCardAspectRatio,
          _minIdCardHeight,
        );

        return GestureDetector(
          onTap: widget.onTap,
          behavior: HitTestBehavior.opaque,
          child: Container(
            height: height,
            decoration: BoxDecoration(
              // Token surface, not an alpha wash — the dark-theme tone carries
              // its own low-luminance plate instead of bleaching the card.
              color: tone.bg,
              border: Border.all(
                color:
                    onFile || missing ? accent : accent.withValues(alpha: 0.4),
              ),
              borderRadius: BorderRadius.circular(14.r),
            ),
            // Clipped so a preview bleeds to the card's rounded edge instead of
            // sitting in a padded box inside it.
            child: ClipRRect(
              borderRadius: BorderRadius.circular(13.r),
              child: Stack(
                // Expand, not passthrough: the card owns the height, so
                // whichever face this side shows fills it rather than sets it.
                fit: StackFit.expand,
                children: [
                  if (preview != null)
                    _IdCardPreview(
                      image: preview,
                      label: label,
                      accent: accent,
                      onFailed: _onPreviewFailed,
                    )
                  else
                    _IdCardPlaceholder(
                      label: label,
                      // A side the server claims but cannot show says so,
                      // instead of the caller's "Uploaded" under a red cross.
                      subtitle: _previewFailed && widget.uploaded
                          ? (widget.unavailableSubtitle ?? widget.subtitle)
                          : widget.subtitle,
                      uploaded: onFile,
                      missing: missing,
                      accent: accent,
                      accentDeep: tone.textActive,
                    ),
                  // Same mark, same corner, both ways round: ✓ on file,
                  // ✕ missing. Shape carries the meaning too, so it survives
                  // colour blindness. The white plate is padded into a ring:
                  // the glyph is a filled disc, so an unpadded plate behind it
                  // is invisible and the mark dissolves into a busy photo.
                  if (onFile || missing)
                    PositionedDirectional(
                      top: 6.h,
                      end: 6.w,
                      child: Container(
                        padding: const EdgeInsets.all(1.5),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: colors.white,
                          boxShadow: [
                            BoxShadow(
                              color:
                                  colors.bg.spotlight.withValues(alpha: 0.28),
                              blurRadius: 4,
                              offset: const Offset(0, 1),
                            ),
                          ],
                        ),
                        child: Icon(
                          onFile ? Icons.check_circle : Icons.cancel,
                          size: 18.r,
                          color: accent,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Floor for a tile's height, in logical pixels. Below this the placeholder's
/// icon plate + label + subtitle stop fitting, and a letterboxed preview beats
/// a clipped one. A getter, not a top-level `final`: `.h` is resolved against
/// the live screen metrics, which a rotation changes.
double get _minIdCardHeight => 88.h;

/// The captured/stored side, filling the card with the label legible over it.
class _IdCardPreview extends StatelessWidget {
  const _IdCardPreview({
    required this.image,
    required this.label,
    required this.accent,
    required this.onFailed,
  });

  final ImageProvider image;
  final String label;
  final Color accent;

  /// The picture could not be decoded or fetched. The card takes over and shows
  /// the side as missing — a document the app cannot display is not evidence
  /// that one is on file.
  final VoidCallback onFailed;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    // No height of its own — the card owns it, so the preview matches the
    // placeholder beside it instead of pinning both to 100.h.
    return Stack(
      fit: StackFit.expand,
      children: [
        // Positioned, so the photo's natural size stays out of the pair's
        // intrinsic-height measurement — a 3000px capture would otherwise
        // stretch both cards to the raw picture's height.
        Positioned.fill(
          child: Image(
            image: image,
            fit: BoxFit.cover,
            // A dead presigned URL (TTL expired), a missing object, or no
            // network: hand it back to the card, which re-renders the side as
            // missing. The old behaviour — a tinted plate under a green tick —
            // told the customer a document was on file that nobody could see.
            errorBuilder: (_, __, ___) {
              onFailed();
              return ColoredBox(color: accent.withValues(alpha: 0.18));
            },
          ),
        ),
        // Bottom scrim: the ID artwork underneath is arbitrary, so the label
        // needs its own contrast rather than borrowing the photo's. Held to the
        // lower third and eased in — now that the tile is ID-shaped there is a
        // real photo to look at, and a half-height veil over it was the reason
        // the card read as a murky plate rather than a document.
        PositionedDirectional(
          start: 0,
          end: 0,
          bottom: 0,
          height: 34.h,
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: const [0, 0.45, 1],
                colors: [
                  colors.bg.spotlight.withValues(alpha: 0),
                  colors.bg.spotlight.withValues(alpha: 0.42),
                  colors.bg.spotlight.withValues(alpha: 0.82),
                ],
              ),
            ),
          ),
        ),
        PositionedDirectional(
          start: 8.w,
          end: 8.w,
          bottom: 7.h,
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: text.caption.semiBold().copyWith(
              color: colors.white,
              // The scrim handles the average case; a blown-out highlight in
              // the ID artwork right under the baseline still needs the glyph
              // to have an edge of its own.
              shadows: [
                Shadow(
                  color: colors.bg.spotlight.withValues(alpha: 0.55),
                  blurRadius: 3,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// No preview available: the original icon plate. Still the state for a side
/// that is not uploaded, and for one that is on file but whose picture could
/// not be fetched.
class _IdCardPlaceholder extends StatelessWidget {
  const _IdCardPlaceholder({
    required this.label,
    required this.subtitle,
    required this.uploaded,
    required this.missing,
    required this.accent,
    required this.accentDeep,
  });

  final String label;
  final String subtitle;
  final bool uploaded;

  /// Nothing on file and nothing captured — the tile states the gap in its own
  /// colour instead of leaving grey copy on a tinted plate.
  final bool missing;
  final Color accent;

  /// Deeper end of the same tone, for the caption line: `main` over the tinted
  /// plate sits on the 4.5:1 floor, and the subtitle is the smallest text here.
  final Color accentDeep;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 8.h),
      child: Column(
        // No `min`: the card hands down a tight height, so the column fills it
        // and centres, and the `Flexible` copy below shrinks instead of
        // overflowing when a translation runs long.
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 32.r,
            height: 32.r,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(9.r),
            ),
            child: Icon(
              uploaded
                  ? Icons.badge_outlined
                  : Icons.add_photo_alternate_outlined,
              size: 18.r,
              color: accent,
            ),
          ),
          Gap(6.h),
          Flexible(
            child: Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: text.bodySmall.semiBold().copyWith(color: accent),
            ),
          ),
          Gap(2.h),
          Flexible(
            child: Text(
              subtitle,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: text.caption.regular().copyWith(
                    color: uploaded || missing
                        ? accentDeep
                        : colors.text.placeholder,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
