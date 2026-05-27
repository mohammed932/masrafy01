import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

/// Compact line-chart primitive — paints a single-stroke sparkline through
/// the supplied [points], auto-scaling vertically to the data's min/max.
///
/// Use it inline next to a numeric metric (e.g. weekly score trend on a
/// dashboard tile). For full-fidelity line charts with axes, gridlines, or
/// tooltips, reach for `package:fl_chart` directly.
class MasrafySparkline extends StatelessWidget {
  const MasrafySparkline({
    super.key,
    required this.points,
    this.color,
    this.width = 80,
    this.height = 30,
  });

  final List<double> points;
  final Color? color;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size(width.w, height.h),
      painter: _SparklinePainter(
        points: points,
        strokeColor: color ?? Colors.blue,
      ),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  const _SparklinePainter({
    required this.points,
    required this.strokeColor,
  });

  final List<double> points;
  final Color strokeColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;

    final minY = points.reduce((a, b) => a < b ? a : b);
    final maxY = points.reduce((a, b) => a > b ? a : b);
    final yRange = maxY - minY;

    final paint = Paint()
      ..color = strokeColor
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    final path = Path();
    for (var i = 0; i < points.length; i++) {
      final x = (i / (points.length - 1)) * size.width;
      final normalizedY = yRange == 0
          ? 0.5
          : (points[i] - minY) / yRange;
      final y = size.height - normalizedY * size.height;

      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_SparklinePainter old) =>
      old.points != points || old.strokeColor != strokeColor;
}
