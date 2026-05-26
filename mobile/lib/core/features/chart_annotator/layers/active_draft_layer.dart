import 'package:flutter/material.dart';

import '../controller/drawing_controller.dart';
import '../model/annotation.dart';

/// Top paint layer: the in-flight draft annotation.
///
/// Subscribes only to [DrawingController.activeDraft]. Repaints every
/// pointer-move frame while a tool is drawing; isolated from the committed
/// layer by its own `RepaintBoundary`.
class ActiveDraftLayer extends StatelessWidget {
  const ActiveDraftLayer({super.key, required this.controller});

  final DrawingController controller;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<Annotation?>(
      valueListenable: controller.activeDraft,
      builder: (_, draft, __) =>
          CustomPaint(painter: _DraftPainter(draft), size: Size.infinite),
    );
  }
}

class _DraftPainter extends CustomPainter {
  const _DraftPainter(this.draft);

  final Annotation? draft;

  @override
  void paint(Canvas canvas, Size size) {
    draft?.paint(canvas);
  }

  @override
  bool shouldRepaint(_DraftPainter oldDelegate) =>
      !identical(draft, oldDelegate.draft);
}
