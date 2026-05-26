import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/widgets.dart' show Matrix4;

/// Applies [transform] to [point] using the matrix' raw storage — avoids
/// pulling in `package:vector_math` (Flutter ships it transitively but the
/// analyzer flags the non-direct dependency).
Offset _apply(Matrix4 transform, Offset point) {
  final m = transform.storage;
  final x = point.dx * m[0] + point.dy * m[4] + m[12];
  final y = point.dx * m[1] + point.dy * m[5] + m[13];
  final w = point.dx * m[3] + point.dy * m[7] + m[15];
  if (w == 0) return Offset(x, y);
  return Offset(x / w, y / w);
}

/// Maps a screen-space point to image space using the inverse of [transform].
///
/// Spec section 3.3: annotations are stored in image space; gesture handlers
/// MUST convert incoming pointer positions through this function before
/// writing anything to the controller.
Offset screenToImage(Offset screenPos, Matrix4 transform) {
  final inverted = Matrix4.inverted(transform);
  return _apply(inverted, screenPos);
}

/// Maps an image-space point back to screen space. Used by selection-handle
/// + crosshair-label positioning that needs viewport pixels.
Offset imageToScreen(Offset imagePos, Matrix4 transform) {
  return _apply(transform, imagePos);
}

/// Current uniform scale factor of [transform] (assumes uniform x/y scale).
double currentScale(Matrix4 transform) {
  final m = transform.storage;
  return math.sqrt(m[0] * m[0] + m[1] * m[1]);
}
