import 'package:flutter/material.dart';

/// Centralised `Paint` cache.
///
/// Spec section 3.8: `Paint` objects MUST NOT be constructed inside any
/// `paint()` method. Every annotation type pulls its cached `Paint` from
/// here, optionally cloning + tweaking colour/strokeWidth without rebuilding
/// from scratch on every frame.
class PaintCache {
  PaintCache._();

  static final Paint stroke = Paint()
    ..style = PaintingStyle.stroke
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round
    ..isAntiAlias = true;

  static final Paint fill = Paint()
    ..style = PaintingStyle.fill
    ..isAntiAlias = true;

  static final Paint labelBackground = Paint()
    ..style = PaintingStyle.fill
    ..color = const Color(0xD9FFFFFF);

  static final Paint pointOutline = Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = 1
    ..color = const Color(0xFFFFFFFF);

  static Paint strokeOf(Color color, double width) => Paint()
    ..style = PaintingStyle.stroke
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round
    ..isAntiAlias = true
    ..color = color
    ..strokeWidth = width;

  static Paint fillOf(Color color) => Paint()
    ..style = PaintingStyle.fill
    ..isAntiAlias = true
    ..color = color;
}
