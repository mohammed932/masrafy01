import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/widgets/common/pilot_html.dart';

/// Visual states for an answer option tile, shared between Study Screen
/// (live session w/ user selection + reveal) and Question Preview
/// (read-only correctness display). Token mapping → see `_paletteFor`.
enum PilotAnswerOptionState {
  /// Default unselected tile — neutral fill, theme border.
  idle,

  /// User picked this option, reveal not yet shown (pre-reveal in study,
  /// or "selected pending" in exam mode).
  selected,

  /// Correct option (either revealed-correct or static "this is the
  /// answer" highlight in preview).
  correct,

  /// User picked this option and it was wrong.
  incorrect,

  /// User picked the wrong option; this tile is the actual correct one
  /// being revealed (border-only success highlight, neutral fill).
  revealedCorrect,
}

/// Shared answer-option tile primitive — single canonical design used
/// across every surface that renders A/B/C/D options (Study live tile,
/// Exam tile, Question Preview reveal, future flashcard backs).
///
/// Visual recipe (matches Figma 3260:44623 / 3260:44626):
/// • Rounded container, state-tinted bg + border (1.2 idle, 2 selected).
/// • Bare large letter on the left (no filled circle), tinted to match
///   tile body text colour so the letter visually fuses with the option.
/// • HTML option text in the same tone.
/// • Optional [trailing] for spinner / check / cross icons.
///
/// Caller knobs: [onTap], [padding], [borderRadius], [labelFontSize],
/// [bodyFontSize].
class PilotAnswerOption extends StatelessWidget {
  const PilotAnswerOption({
    super.key,
    required this.state,
    required this.label,
    required this.htmlText,
    this.trailing,
    this.onTap,
    this.padding,
    this.borderRadius,
    this.labelFontSize = 22,
    this.bodyFontSize = 14,
    this.lineHeight = 22 / 14,
  });

  final PilotAnswerOptionState state;
  final String label;
  final String htmlText;
  final Widget? trailing;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? padding;
  final BorderRadius? borderRadius;
  final double labelFontSize;
  final double bodyFontSize;
  final double lineHeight;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    final palette = _paletteFor(state, colors);
    final borderWidth = state == PilotAnswerOptionState.selected ? 2.r : 1.2;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: double.infinity,
        padding: padding ??
            EdgeInsets.symmetric(horizontal: 16.w, vertical: 16.h),
        decoration: BoxDecoration(
          color: palette.bg,
          border: Border.all(color: palette.border, width: borderWidth),
          borderRadius: borderRadius ?? BorderRadius.circular(12.r),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 28.w,
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: texts.heading4.semiBold().copyWith(
                      color: palette.text,
                      fontSize: labelFontSize.sp,
                      height: 1.0,
                    ),
              ),
            ),
            Gap(12.w),
            Expanded(
              child: PilotHtml(
                data: htmlText,
                textColor: palette.text,
                fontSize: bodyFontSize.sp,
                lineHeight: lineHeight,
              ),
            ),
            if (trailing != null) ...[
              Gap(8.w),
              trailing!,
            ],
          ],
        ),
      ),
    );
  }
}

class PilotAnswerOptionPalette {
  const PilotAnswerOptionPalette({
    required this.bg,
    required this.border,
    required this.text,
  });

  final Color bg;
  final Color border;
  final Color text;
}

/// Token map for each state. Exported so callers that need individual
/// colours (custom trailing icons matching the tile palette) can read
/// from the same source the tile uses.
PilotAnswerOptionPalette paletteFor(
  PilotAnswerOptionState state,
  PilotColorTheme colors,
) =>
    _paletteFor(state, colors);

PilotAnswerOptionPalette _paletteFor(
  PilotAnswerOptionState state,
  PilotColorTheme colors,
) {
  switch (state) {
    case PilotAnswerOptionState.correct:
      return PilotAnswerOptionPalette(
        bg: colors.success.bg,
        border: colors.success.active,
        text: colors.success.active,
      );
    case PilotAnswerOptionState.incorrect:
      return PilotAnswerOptionPalette(
        bg: colors.error.bg,
        border: colors.error.active,
        text: colors.error.active,
      );
    case PilotAnswerOptionState.revealedCorrect:
      return PilotAnswerOptionPalette(
        bg: colors.bg.container,
        border: colors.success.active,
        text: colors.success.active,
      );
    case PilotAnswerOptionState.selected:
      return PilotAnswerOptionPalette(
        bg: colors.fill.handleBg,
        border: colors.primary.main,
        text: colors.primary.main,
      );
    case PilotAnswerOptionState.idle:
      return PilotAnswerOptionPalette(
        bg: colors.fill.handleBg,
        border: colors.border.main,
        text: colors.text.primary,
      );
  }
}
