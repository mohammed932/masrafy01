import 'package:flutter/material.dart';

/// Bottom-most paint layer: the chart raster.
///
/// Wrapped in a `RepaintBoundary` by the parent shell so it NEVER repaints
/// after the initial decode (the most expensive paint in the stack).
///
/// Stage 1 placeholder: renders a checkerboard so the layered stack is
/// visually verifiable in DevTools. Real implementation lands in Stage 2,
/// when [imageProvider] is wired through `Image(cacheWidth: ...)`.
class ImageLayer extends StatelessWidget {
  const ImageLayer({super.key, this.imageProvider});

  final ImageProvider? imageProvider;

  @override
  Widget build(BuildContext context) {
    final provider = imageProvider;
    if (provider == null) {
      return const _CheckerboardPlaceholder();
    }
    // Decode at source resolution so the chart stays crisp under zoom and
    // panning. `BoxFit.contain` preserves the source aspect ratio.
    return Image(
      image: provider,
      fit: BoxFit.contain,
      gaplessPlayback: true,
      filterQuality: FilterQuality.medium,
    );
  }
}

class _CheckerboardPlaceholder extends StatelessWidget {
  const _CheckerboardPlaceholder();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(painter: _CheckerboardPainter(), size: Size.infinite);
  }
}

class _CheckerboardPainter extends CustomPainter {
  static final Paint _dark = Paint()..color = const Color(0xFF1F1F1F);
  static final Paint _light = Paint()..color = const Color(0xFF2A2A2A);

  @override
  void paint(Canvas canvas, Size size) {
    const cell = 24.0;
    final cols = (size.width / cell).ceil();
    final rows = (size.height / cell).ceil();
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        final paint = (r + c).isEven ? _dark : _light;
        canvas.drawRect(Rect.fromLTWH(c * cell, r * cell, cell, cell), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_CheckerboardPainter oldDelegate) => false;
}
