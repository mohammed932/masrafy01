import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../controller/drawing_controller.dart';
import '../util/paint_cache.dart';

/// Dedicated paint layer for the transient crosshair.
///
/// Spec section 5.9: dashed lines spanning the full visible canvas, 5px
/// filled centre, coordinate label offset (+12, -24) from the intersection,
/// origin at image centre.
class CrosshairLayer extends StatelessWidget {
  const CrosshairLayer({
    super.key,
    required this.controller,
    required this.imageSize,
    required this.color,
  });

  final DrawingController controller;

  /// Decoded image dimensions in image-space pixels. Used for the
  /// origin-at-centre coordinate readout. Pass `Size.zero` when unknown — the
  /// label falls back to raw image-space coords.
  final Size imageSize;

  final Color color;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<Offset?>(
      valueListenable: controller.crosshairPosition,
      builder: (_, position, __) => CustomPaint(
        painter: _CrosshairPainter(
          position: position,
          color: color,
          imageSize: imageSize,
        ),
        size: Size.infinite,
      ),
    );
  }
}

class _CrosshairPainter extends CustomPainter {
  const _CrosshairPainter({
    required this.position,
    required this.color,
    required this.imageSize,
  });

  final Offset? position;
  final Color color;
  final Size imageSize;

  @override
  void paint(Canvas canvas, Size size) {
    final p = position;
    if (p == null) return;
    final stroke = PaintCache.strokeOf(color, 1);
    _dashedLine(canvas, Offset(-5000, p.dy), Offset(5000, p.dy), stroke);
    _dashedLine(canvas, Offset(p.dx, -5000), Offset(p.dx, 5000), stroke);
    canvas.drawCircle(p, 5, PaintCache.fillOf(color));

    final origin = imageSize == Size.zero
        ? Offset.zero
        : Offset(imageSize.width / 2, imageSize.height / 2);
    final coord = Offset(p.dx - origin.dx, origin.dy - p.dy);
    final label =
        '(${coord.dx.toStringAsFixed(0)}, ${coord.dy.toStringAsFixed(0)})';
    final tp = TextPainter(
      text: TextSpan(
        text: label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final bg = Rect.fromLTWH(
      p.dx + 12 - 4,
      p.dy - 24 - 2,
      tp.width + 8,
      tp.height + 4,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(bg, const Radius.circular(3)),
      PaintCache.labelBackground,
    );
    tp.paint(canvas, Offset(bg.left + 4, bg.top + 2));
  }

  void _dashedLine(Canvas canvas, Offset a, Offset b, Paint paint) {
    const dash = 8.0;
    const gap = 5.0;
    final dir = b - a;
    final length = dir.distance;
    if (length == 0) return;
    final unit = Offset(dir.dx / length, dir.dy / length);
    var travelled = 0.0;
    while (travelled < length) {
      final segStart = a + unit * travelled;
      final segEnd = a + unit * math.min(travelled + dash, length);
      canvas.drawLine(segStart, segEnd, paint);
      travelled += dash + gap;
    }
  }

  @override
  bool shouldRepaint(_CrosshairPainter old) =>
      old.position != position ||
      old.color != color ||
      old.imageSize != imageSize;
}
