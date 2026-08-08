import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
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
    required this.sectionLabel,
    required this.sectionHint,
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
  });

  final String sectionLabel;
  final String sectionHint;
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

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 6.w,
          children: [
            Text(
              sectionLabel.toUpperCase(),
              style: text.caption.semiBold().copyWith(
                    color: colors.primary.main,
                    letterSpacing: 0.66,
                  ),
            ),
            Text(
              sectionHint,
              style: text.caption
                  .regular()
                  .copyWith(color: colors.text.placeholder),
            ),
          ],
        ),
        Gap(8.h),
        // Both sides are one control, so the tiles read as a matched pair:
        // `Expanded` equalises width, `IntrinsicHeight` + stretch equalises
        // height whichever side is taller (a two-line placeholder subtitle used
        // to outgrow the fixed-height preview beside it).
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
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

    return GestureDetector(
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        constraints: BoxConstraints(minHeight: 100.h),
        decoration: BoxDecoration(
          // Token surface, not an alpha wash — the dark-theme tone carries its
          // own low-luminance plate instead of bleaching the card.
          color: tone.bg,
          border: Border.all(
            color: onFile || missing ? accent : accent.withValues(alpha: 0.4),
          ),
          borderRadius: BorderRadius.circular(14.r),
        ),
        // Clipped so a preview bleeds to the card's rounded edge instead of
        // sitting in a padded box inside it.
        child: ClipRRect(
          borderRadius: BorderRadius.circular(13.r),
          child: Stack(
            // Expand, not passthrough: the pair share one height, so whichever
            // face this side shows must fill the card rather than set it.
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
                  // A side the server claims but cannot show says so, instead
                  // of the caller's "Uploaded" under a red cross.
                  subtitle: _previewFailed && widget.uploaded
                      ? (widget.unavailableSubtitle ?? widget.subtitle)
                      : widget.subtitle,
                  uploaded: onFile,
                  missing: missing,
                  accent: accent,
                  accentDeep: tone.textActive,
                ),
              // Same mark, same corner, both ways round: ✓ on file, ✕ missing.
              // Shape carries the meaning too, so it survives colour blindness.
              if (onFile || missing)
                PositionedDirectional(
                  top: 4.h,
                  end: 4.w,
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: colors.white,
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
  }
}

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
        // needs its own contrast rather than borrowing the photo's.
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.center,
                end: Alignment.bottomCenter,
                colors: [
                  colors.bg.spotlight.withValues(alpha: 0),
                  colors.bg.spotlight.withValues(alpha: 0.75),
                ],
              ),
            ),
          ),
        ),
        PositionedDirectional(
          start: 8.w,
          end: 8.w,
          bottom: 8.h,
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: text.caption.semiBold().copyWith(color: colors.white),
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
      padding: EdgeInsets.symmetric(horizontal: 11.w, vertical: 15.h),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        // Centred, so the shorter side's plate sits mid-card when the taller
        // side sets the shared height instead of hanging from the top.
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 38.r,
            height: 38.r,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(10.r),
            ),
            child: Icon(
              uploaded
                  ? Icons.badge_outlined
                  : Icons.add_photo_alternate_outlined,
              size: 20.r,
              color: accent,
            ),
          ),
          Gap(8.h),
          Text(
            label,
            textAlign: TextAlign.center,
            style: text.bodySmall.semiBold().copyWith(color: accent),
          ),
          Gap(2.h),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: text.caption.regular().copyWith(
                  color: uploaded || missing
                      ? accentDeep
                      : colors.text.placeholder,
                ),
          ),
        ],
      ),
    );
  }
}
