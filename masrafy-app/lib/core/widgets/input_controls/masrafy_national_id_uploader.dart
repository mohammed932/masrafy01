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
              style: text.caption.regular().copyWith(color: colors.text.placeholder),
            ),
          ],
        ),
        Gap(8.h),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _IdCard(
                label: frontLabel,
                subtitle: frontSubtitle,
                uploaded: frontUploaded,
                onTap: onTapFront,
              ),
            ),
            Gap(10.w),
            Expanded(
              child: _IdCard(
                label: backLabel,
                subtitle: backSubtitle,
                uploaded: backUploaded,
                onTap: onTapBack,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _IdCard extends StatelessWidget {
  const _IdCard({
    required this.label,
    required this.subtitle,
    required this.uploaded,
    this.onTap,
  });

  final String label;
  final String subtitle;
  final bool uploaded;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final accent = uploaded ? colors.success.main : colors.secondary.main;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        constraints: BoxConstraints(minHeight: 100.h),
        padding: EdgeInsets.symmetric(horizontal: 11.w, vertical: 15.h),
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.06),
          border: Border.all(color: accent.withValues(alpha: uploaded ? 1 : 0.4)),
          borderRadius: BorderRadius.circular(14.r),
        ),
        child: Stack(
          children: [
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 38.r,
                  height: 38.r,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(10.r),
                  ),
                  child: Icon(
                    uploaded ? Icons.badge_outlined : Icons.add_photo_alternate_outlined,
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
                        color: uploaded ? colors.success.main : colors.text.placeholder,
                      ),
                ),
              ],
            ),
            if (uploaded)
              PositionedDirectional(
                top: 0,
                end: 0,
                child: Icon(Icons.check_circle, size: 18.r, color: colors.success.main),
              ),
          ],
        ),
      ),
    );
  }
}
