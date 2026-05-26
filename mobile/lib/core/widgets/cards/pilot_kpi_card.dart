import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/utils/pilot_assets.dart';

/// KPI trend direction — drives both the arrow rotation and the
/// arrow/sparkline tint applied by [PilotKpiCard].
enum PilotTrendDirection { up, down, flat }

/// A reusable KPI card with a large value, label, trend chip,
/// and a sparkline area at the bottom.
///
/// Pixel-perfect implementation of Figma node 3388:61307
/// (Frame 1000002231 — Reports / Overview KPI card).
class PilotKpiCard extends StatelessWidget {
  const PilotKpiCard({
    super.key,
    required this.value,
    required this.label,
    required this.trendLabel,
    required this.trendDirection,
    required this.sparklinePoints,
  });

  /// Big value text — e.g. "8", "79%", "27:35h".
  final String value;

  /// Label below the value — e.g. "Test Taken".
  final String label;

  /// Trend caption — e.g. "12% This Week".
  final String trendLabel;

  /// Trend direction — drives arrow rotation and sparkline color.
  final PilotTrendDirection trendDirection;

  /// Sparkline data points. When empty / 1-element, a dashed flat
  /// placeholder is drawn instead.
  final List<double> sparklinePoints;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);

    final trendColor = switch (trendDirection) {
      PilotTrendDirection.up => colors.primary.hover,
      PilotTrendDirection.down => colors.error.main,
      PilotTrendDirection.flat => colors.text.tertiary,
    };

    final trendLabelColor = switch (trendDirection) {
      PilotTrendDirection.up => colors.success.main,
      PilotTrendDirection.down => colors.error.main,
      PilotTrendDirection.flat => colors.text.tertiary,
    };

    // arrow_small_up.svg already points NE. Rotate +90° CW for DOWN
    // (NE → SE), -45° for FLAT (NE → E).
    final arrowAngle = switch (trendDirection) {
      PilotTrendDirection.up => 0.0,
      PilotTrendDirection.down => math.pi / 2,
      PilotTrendDirection.flat => -math.pi / 4,
    };

    return Container(
      decoration: BoxDecoration(
        color: colors.fill.handleBg,
        border: Border.all(color: colors.border.main),
        borderRadius: BorderRadius.circular(20.r),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(16.w, 16.h, 16.w, 16.h),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: texts.heading2.semiBold(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                SizedBox(height: 4.h),
                Text(
                  label,
                  style: texts.body.copyWith(color: colors.text.secondary),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                SizedBox(height: 4.h),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 24.r,
                      height: 24.r,
                      child: Transform.rotate(
                        angle: arrowAngle,
                        child: SvgPicture.asset(
                          PilotAssets.kArrowSmallUp,
                          colorFilter: ColorFilter.mode(
                            trendColor,
                            BlendMode.srcIn,
                          ),
                        ),
                      ),
                    ),
                    SizedBox(width: 2.w),
                    Flexible(
                      child: Text(
                        trendLabel,
                        style: texts.caption.copyWith(color: trendLabelColor),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          SizedBox(
            height: 75.h,
            width: double.infinity,
            child: CustomPaint(
              painter: _PilotKpiSparklinePainter(
                points: sparklinePoints,
                lineColor: trendColor,
                fillGradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    trendColor.withValues(alpha: 0.45),
                    trendColor.withValues(alpha: 0.03),
                  ],
                ),
                placeholderColor: colors.border.main,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PilotKpiSparklinePainter extends CustomPainter {
  const _PilotKpiSparklinePainter({
    required this.points,
    required this.lineColor,
    required this.fillGradient,
    required this.placeholderColor,
  });

  final List<double> points;
  final Color lineColor;
  final Gradient fillGradient;
  final Color placeholderColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) {
      _paintPlaceholder(canvas, size);
      return;
    }
    final minY = points.reduce((a, b) => a < b ? a : b);
    final maxY = points.reduce((a, b) => a > b ? a : b);
    final yRange = (maxY - minY) == 0 ? 1.0 : maxY - minY;

    double xAt(int i) => (i / (points.length - 1)) * size.width;
    double yAt(int i) {
      final norm = (points[i] - minY) / yRange;
      return size.height - norm * size.height * 0.85 - size.height * 0.05;
    }

    final linePath = Path()..moveTo(xAt(0), yAt(0));
    for (int i = 1; i < points.length; i++) {
      linePath.lineTo(xAt(i), yAt(i));
    }
    final fillPath = Path.from(linePath)
      ..lineTo(xAt(points.length - 1), size.height)
      ..lineTo(xAt(0), size.height)
      ..close();

    canvas.drawPath(
      fillPath,
      Paint()
        ..shader = fillGradient.createShader(Offset.zero & size)
        ..style = PaintingStyle.fill,
    );
    canvas.drawPath(
      linePath,
      Paint()
        ..color = lineColor
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke,
    );
  }

  void _paintPlaceholder(Canvas canvas, Size size) {
    final dashPaint = Paint()
      ..color = placeholderColor
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;
    const dashWidth = 4.0;
    const dashGap = 3.0;
    double x = 0;
    final y = size.height * 0.83;
    while (x < size.width) {
      canvas.drawLine(Offset(x, y), Offset(x + dashWidth, y), dashPaint);
      x += dashWidth + dashGap;
    }
  }

  @override
  bool shouldRepaint(_PilotKpiSparklinePainter old) =>
      old.points != points ||
      old.lineColor != lineColor ||
      old.fillGradient != fillGradient ||
      old.placeholderColor != placeholderColor;
}
