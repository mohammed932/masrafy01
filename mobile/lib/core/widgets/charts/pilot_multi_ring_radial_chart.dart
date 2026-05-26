// First member of lib/core/widgets/charts/ — promote more chart
// primitives here as they emerge.

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';

class SubjectRing {
  final String name;
  final double fraction;
  final Color color;

  const SubjectRing({
    required this.name,
    required this.fraction,
    required this.color,
  });
}

/// Concentric radial chart powered by `percent_indicator` —
/// each ring is a `CircularPercentIndicator`, stacked outermost-first
/// with progressively smaller radii. Picked up the package so the
/// rings animate smoothly + the math is offloaded to a well-tested
/// primitive instead of a hand-rolled `CustomPainter`.
class PilotMultiRingRadialChart extends StatelessWidget {
  const PilotMultiRingRadialChart({
    super.key,
    required this.rings,
    this.centerPercentage,
    this.centerCaption,
    this.size = 240,
    this.ringStroke = 12,
    this.ringGap = 4,
    this.animationDuration = const Duration(milliseconds: 800),
  });

  final List<SubjectRing> rings;
  final String? centerPercentage;
  final String? centerCaption;
  final double size;
  final double ringStroke;
  final double ringGap;
  final Duration animationDuration;

  @override
  Widget build(BuildContext context) {
    final texts = PilotTextTheme.of(context);
    final colors = PilotColorTheme.of(context);

    final stroke = ringStroke.r;
    final gap = ringGap.r;
    final outerDiameter = size.r;

    return SizedBox(
      width: outerDiameter,
      height: outerDiameter,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // First subject = innermost ring (matches Figma 3268:100917:
          // Air Law / purple is the inner band, Performance / red is
          // the outer band). Invert the radius math so i = 0 hugs the
          // center and i = last hugs the outer edge.
          for (var i = 0; i < rings.length; i++)
            CircularPercentIndicator(
              radius: (outerDiameter / 2) -
                  (rings.length - 1 - i) * (stroke + gap) -
                  stroke / 2,
              lineWidth: stroke,
              percent: rings[i].fraction.clamp(0.0, 1.0),
              progressColor: rings[i].color,
              backgroundColor: rings[i].color.withValues(alpha: 0.22),
              circularStrokeCap: CircularStrokeCap.round,
              animation: true,
              animationDuration: animationDuration.inMilliseconds,
            ),
          if (centerPercentage != null || centerCaption != null)
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (centerPercentage != null)
                  Text(centerPercentage!, style: texts.heading2.bold()),
                if (centerCaption != null)
                  Text(
                    centerCaption!,
                    style: texts.bodySmall.copyWith(
                      color: colors.text.secondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
              ],
            ),
        ],
      ),
    );
  }
}
