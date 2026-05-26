part of '../annotation.dart';

final class EllipseAnnotation extends Annotation {
  const EllipseAnnotation({
    required this.id,
    required this.rect,
    this.color = kDefaultStrokeColor,
    this.strokeWidth = kDefaultStrokeWidth,
  });

  static const String kType = 'ellipse';

  @override
  final String id;
  final Rect rect;
  @override
  final Color color;
  @override
  final double strokeWidth;

  @override
  void paint(Canvas canvas) {
    canvas.drawOval(rect, PaintCache.strokeOf(color, strokeWidth));
  }

  @override
  bool hitTest(Offset p) {
    if (rect.width == 0 || rect.height == 0) return false;
    final cx = rect.center.dx;
    final cy = rect.center.dy;
    final rx = rect.width / 2;
    final ry = rect.height / 2;
    final dx = (p.dx - cx) / rx;
    final dy = (p.dy - cy) / ry;
    final outer = (dx * dx + dy * dy);
    return (outer - 1).abs() < 0.25; // ring tolerance ~25%
  }

  @override
  Rect get boundsInImageSpace => rect.inflate(4);

  @override
  EllipseAnnotation translate(Offset delta) => EllipseAnnotation(
    id: id,
    rect: rect.shift(delta),
    color: color,
    strokeWidth: strokeWidth,
  );

  @override
  EllipseAnnotation resize(Rect oldBounds, Rect newBounds) => EllipseAnnotation(
    id: id,
    rect: remapRect(rect, oldBounds, newBounds),
    color: color,
    strokeWidth: strokeWidth,
  );

  @override
  Map<String, dynamic> toJson() => {
    'type': kType,
    'id': id,
    'rect': [rect.left, rect.top, rect.width, rect.height],
    'color': _colorToJson(color),
    'strokeWidth': strokeWidth,
  };

  factory EllipseAnnotation.fromJson(Map<String, dynamic> json) {
    final r = json['rect'] as List<dynamic>;
    return EllipseAnnotation(
      id: json['id'] as String,
      rect: Rect.fromLTWH(
        (r[0] as num).toDouble(),
        (r[1] as num).toDouble(),
        (r[2] as num).toDouble(),
        (r[3] as num).toDouble(),
      ),
      color: _colorFromJson(json['color'] as int),
      strokeWidth: (json['strokeWidth'] as num).toDouble(),
    );
  }
}
