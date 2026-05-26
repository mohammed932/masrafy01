import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/utils/pilot_assets.dart';
import 'package:app/core/widgets/common/pilot_html.dart';

/// Single-question flashcard primitive. Tap to flip between [front] and
/// [back]. Mirrors the Angular `<app-flip-card>` visual (stacked-deck
/// background, primary-teal front, pale-teal back, correct-answer
/// callout on the back). Pure-data inputs — no cubit dependency. Session-
/// coupled callers (e.g. the Study screen's deck navigation) compose this
/// primitive with their own chrome on top.
class PilotFlipCard extends StatefulWidget {
  const PilotFlipCard({
    super.key,
    required this.front,
    required this.back,
    this.correctAnswerText,
    this.indexLabel,
  });

  /// HTML / markdown rich-text rendered on the front face.
  final String front;

  /// HTML / markdown rich-text rendered on the back face.
  final String back;

  /// Optional callout shown beneath [back] highlighting the correct answer.
  final String? correctAnswerText;

  /// Optional position indicator, e.g. "1 / 12". Hidden when null.
  final String? indexLabel;

  @override
  State<PilotFlipCard> createState() => _PilotFlipCardState();
}

class _PilotFlipCardState extends State<PilotFlipCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _flip;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 450),
      vsync: this,
    );
    _flip = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _toggleFlip() {
    if (_ctrl.isAnimating) return;
    if (_ctrl.value == 0) {
      _ctrl.forward();
    } else {
      _ctrl.reverse();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: AnimatedBuilder(
          animation: _flip,
          builder: (context, _) {
            final t = _flip.value;
            final showBack = t >= 0.5;
            final transform = Matrix4.identity()
              ..setEntry(3, 2, 0.001)
              ..rotateY(t * 3.14159);
            return GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: _toggleFlip,
              child: _StackedDeck(
                isBack: showBack,
                child: Transform(
                  alignment: Alignment.center,
                  transform: transform,
                  child: showBack
                      ? Transform(
                          alignment: Alignment.center,
                          transform: Matrix4.identity()..rotateY(3.14159),
                          child: _BackFace(
                            html: widget.back,
                            indexLabel: widget.indexLabel,
                            correctAnswerText: widget.correctAnswerText,
                            onFlip: _toggleFlip,
                          ),
                        )
                      : _FrontFace(
                          html: widget.front,
                          indexLabel: widget.indexLabel,
                          onFlip: _toggleFlip,
                        ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _StackedDeck extends StatelessWidget {
  const _StackedDeck({required this.isBack, required this.child});
  final bool isBack;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final ghostColor = isBack
        ? colors.primary.bg
        : colors.primary.main.withValues(alpha: 0.6);
    final ghostBorder = isBack
        ? colors.primary.main.withValues(alpha: 0.2)
        : Colors.transparent;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned(
          right: -12.w,
          top: 12.h,
          bottom: -12.h,
          left: 12.w,
          child: Container(
            decoration: BoxDecoration(
              color: ghostColor.withValues(alpha: 0.5),
              border: Border.all(color: ghostBorder),
              borderRadius: BorderRadius.circular(20.r),
            ),
          ),
        ),
        Positioned(
          right: -6.w,
          top: 6.h,
          bottom: -6.h,
          left: 6.w,
          child: Container(
            decoration: BoxDecoration(
              color: ghostColor,
              border: Border.all(color: ghostBorder),
              borderRadius: BorderRadius.circular(20.r),
            ),
          ),
        ),
        child,
      ],
    );
  }
}

class _FrontFace extends StatelessWidget {
  const _FrontFace({
    required this.html,
    required this.indexLabel,
    required this.onFlip,
  });

  final String html;
  final String? indexLabel;
  final VoidCallback onFlip;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    return Container(
      height: 380.h,
      padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 24.h),
      decoration: BoxDecoration(
        color: colors.primary.main,
        borderRadius: BorderRadius.circular(20.r),
        boxShadow: [
          BoxShadow(
            color: colors.primary.main.withValues(alpha: 0.18),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Question',
                style: texts.heading5.semiBold().copyWith(
                      color: colors.white,
                      fontSize: 20.sp,
                    ),
              ),
              if (indexLabel != null)
                Text(
                  indexLabel!,
                  style: texts.body.copyWith(
                    color: colors.white.withValues(alpha: 0.85),
                    fontSize: 14.sp,
                  ),
                ),
            ],
          ),
          Gap(20.h),
          Expanded(
            child: SingleChildScrollView(
              child: PilotHtml(
                data: html,
                fontSize: 18.sp,
                fontWeight: FontWeight.w600,
                lineHeight: 26 / 18,
                textColor: colors.white,
              ),
            ),
          ),
          Gap(8.h),
          _FlipHint(onTap: onFlip, tint: colors.white),
        ],
      ),
    );
  }
}

class _BackFace extends StatelessWidget {
  const _BackFace({
    required this.html,
    required this.indexLabel,
    required this.correctAnswerText,
    required this.onFlip,
  });

  final String html;
  final String? indexLabel;
  final String? correctAnswerText;
  final VoidCallback onFlip;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    return Container(
      height: 380.h,
      padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 24.h),
      decoration: BoxDecoration(
        color: colors.primary.bg,
        border: Border.all(color: colors.primary.main.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(20.r),
        boxShadow: [
          BoxShadow(
            color: colors.primary.main.withValues(alpha: 0.12),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Answer',
                style: texts.heading5.semiBold().copyWith(
                      color: colors.text.heading,
                      fontSize: 20.sp,
                    ),
              ),
              if (indexLabel != null)
                Text(
                  indexLabel!,
                  style: texts.body.copyWith(
                    color: colors.text.secondary,
                    fontSize: 14.sp,
                  ),
                ),
            ],
          ),
          Gap(20.h),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  PilotHtml(
                    data: html,
                    fontSize: 14.sp,
                    lineHeight: 22 / 14,
                    textColor: colors.text.heading,
                  ),
                  if (correctAnswerText != null) ...[
                    Gap(20.h),
                    _CorrectAnswerCallout(text: correctAnswerText!),
                  ],
                ],
              ),
            ),
          ),
          Gap(8.h),
          _FlipHint(onTap: onFlip, tint: colors.text.heading),
        ],
      ),
    );
  }
}

class _CorrectAnswerCallout extends StatelessWidget {
  const _CorrectAnswerCallout({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 12.h),
      decoration: BoxDecoration(
        color: colors.bg.container.withValues(alpha: 0.6),
        border: Border.all(color: colors.primary.main),
        borderRadius: BorderRadius.circular(12.r),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SvgPicture.asset(
            PilotAssets.kNotifCheckMark,
            width: 18.r,
            height: 18.r,
            colorFilter: ColorFilter.mode(colors.primary.main, BlendMode.srcIn),
          ),
          Gap(8.w),
          Expanded(
            child: PilotHtml(
              data: text,
              fontSize: 14.sp,
              fontWeight: FontWeight.w600,
              lineHeight: 22 / 14,
              textColor: colors.primary.main,
            ),
          ),
        ],
      ),
    );
  }
}

class _FlipHint extends StatelessWidget {
  const _FlipHint({required this.onTap, required this.tint});
  final VoidCallback onTap;
  final Color tint;

  @override
  Widget build(BuildContext context) {
    final texts = PilotTextTheme.of(context);
    return Center(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SvgPicture.asset(
              PilotAssets.kStudyCopyTwotone,
              width: 18.r,
              height: 18.r,
              colorFilter: ColorFilter.mode(tint, BlendMode.srcIn),
            ),
            Gap(8.w),
            Text(
              'Click to flip',
              style: texts.body.copyWith(color: tint, fontSize: 14.sp),
            ),
          ],
        ),
      ),
    );
  }
}
