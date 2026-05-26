import 'package:flutter/material.dart';

import '../controller/drawing_controller.dart';
import '../model/annotation.dart';
import '../util/coordinate_transform.dart';

/// Renders 8 resize handles around the selected annotation's bounding box.
/// Stage 7 scope: visual only — actual resize math lands per-annotation in a
/// follow-up.
class SelectionHandles extends StatelessWidget {
  const SelectionHandles({
    super.key,
    required this.controller,
    required this.transformationController,
  });

  final DrawingController controller;
  final TransformationController transformationController;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<Annotation?>(
      valueListenable: controller.selectedAnnotation,
      builder: (_, selected, __) {
        if (selected == null) return const SizedBox.shrink();
        return ValueListenableBuilder<Matrix4>(
          valueListenable: transformationController,
          builder: (_, matrix, __) {
            final imageBounds = selected.boundsInImageSpace;
            final tl = imageToScreen(imageBounds.topLeft, matrix);
            final br = imageToScreen(imageBounds.bottomRight, matrix);
            final screenBounds = Rect.fromPoints(tl, br);
            return _HandlesPainter(
              bounds: screenBounds,
              color: Theme.of(context).colorScheme.primary,
            );
          },
        );
      },
    );
  }
}

class _HandlesPainter extends StatelessWidget {
  const _HandlesPainter({required this.bounds, required this.color});

  final Rect bounds;
  final Color color;

  @override
  Widget build(BuildContext context) {
    const r = 6.0;
    final points = <Offset>[
      bounds.topLeft,
      bounds.topCenter,
      bounds.topRight,
      bounds.centerLeft,
      bounds.centerRight,
      bounds.bottomLeft,
      bounds.bottomCenter,
      bounds.bottomRight,
    ];
    return IgnorePointer(
      child: CustomPaint(
        painter: _Painter(
          bounds: bounds,
          points: points,
          radius: r,
          color: color,
        ),
        size: Size.infinite,
      ),
    );
  }
}

class _Painter extends CustomPainter {
  const _Painter({
    required this.bounds,
    required this.points,
    required this.radius,
    required this.color,
  });

  final Rect bounds;
  final List<Offset> points;
  final double radius;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final outline = Paint()
      ..style = PaintingStyle.stroke
      ..color = color.withValues(alpha: 0.85)
      ..strokeWidth = 1;
    canvas.drawRect(bounds, outline);
    final handleFill = Paint()..color = Colors.white;
    final handleStroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..color = color;
    for (final p in points) {
      canvas.drawCircle(p, radius, handleFill);
      canvas.drawCircle(p, radius, handleStroke);
    }
  }

  @override
  bool shouldRepaint(_Painter old) =>
      old.bounds != bounds || old.color != color;
}
