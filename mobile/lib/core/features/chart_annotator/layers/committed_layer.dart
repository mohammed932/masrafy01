import 'package:flutter/material.dart';

import '../controller/drawing_controller.dart';
import '../model/annotation.dart';

/// Middle paint layer: every persisted annotation.
///
/// Subscribes only to [DrawingController.committed] so it repaints solely on
/// commit / undo / redo — never during draft frames. The parent shell wraps
/// this in a `RepaintBoundary` to isolate it from the active-draft layer.
class CommittedLayer extends StatelessWidget {
  const CommittedLayer({super.key, required this.controller});

  final DrawingController controller;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<Annotation>>(
      valueListenable: controller.committed,
      builder: (_, annotations, __) => CustomPaint(
        painter: _CommittedPainter(annotations),
        size: Size.infinite,
      ),
    );
  }
}

class _CommittedPainter extends CustomPainter {
  const _CommittedPainter(this.annotations);

  final List<Annotation> annotations;

  @override
  void paint(Canvas canvas, Size size) {
    for (final annotation in annotations) {
      annotation.paint(canvas);
    }
  }

  @override
  bool shouldRepaint(_CommittedPainter oldDelegate) =>
      !identical(annotations, oldDelegate.annotations);
}
