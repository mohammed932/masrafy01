import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';

/// Concentric "operation succeeded" badge — outer disc tinted with
/// `primary.bgHover`, inner stroked ring + check glyph drawn in
/// `primary.main`. Sized to render a 100r glyph inside a 16r padding
/// ring (132r total, matching the Figma success-template spec).
class PilotSuccessCheckIcon extends StatelessWidget {
  const PilotSuccessCheckIcon({super.key, this.size = 100});

  /// Size of the inner glyph (the surrounding disc adds 16r padding).
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    return Container(
      padding: EdgeInsets.all(16.r),
      decoration: BoxDecoration(
        color: colors.primary.bgHover,
        shape: BoxShape.circle,
      ),
      child: SizedBox(
        width: size.r,
        height: size.r,
        child: CustomPaint(
          painter: _CheckCirclePainter(color: colors.primary.main),
        ),
      ),
    );
  }
}

class _CheckCirclePainter extends CustomPainter {
  const _CheckCirclePainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.shortestSide / 2;
    final ringStroke = size.shortestSide * 0.075;

    final ringPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = ringStroke
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, radius - ringStroke / 2, ringPaint);

    final tickPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = ringStroke * 1.1
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final path = Path()
      ..moveTo(size.width * 0.30, size.height * 0.52)
      ..lineTo(size.width * 0.45, size.height * 0.67)
      ..lineTo(size.width * 0.72, size.height * 0.38);
    canvas.drawPath(path, tickPaint);
  }

  @override
  bool shouldRepaint(covariant _CheckCirclePainter old) => old.color != color;
}
