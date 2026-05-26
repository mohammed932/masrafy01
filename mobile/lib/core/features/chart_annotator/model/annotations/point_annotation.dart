part of '../annotation.dart';

final class PointAnnotation extends Annotation {
  const PointAnnotation({
    required this.id,
    required this.position,
    this.color = kDefaultStrokeColor,
    this.radius = 5,
  });

  static const String kType = 'point';

  @override
  final String id;
  final Offset position;
  @override
  final Color color;
  final double radius;

  @override
  double get strokeWidth => 1;

  @override
  void paint(Canvas canvas) {
    canvas.drawCircle(position, radius, PaintCache.fillOf(color));
    canvas.drawCircle(position, radius, PaintCache.pointOutline);
  }

  @override
  bool hitTest(Offset p) => (p - position).distance <= radius + kHitSlop;

  @override
  Rect get boundsInImageSpace =>
      Rect.fromCircle(center: position, radius: radius + 4);

  @override
  PointAnnotation translate(Offset delta) => PointAnnotation(
    id: id,
    position: position + delta,
    color: color,
    radius: radius,
  );

  @override
  PointAnnotation resize(Rect oldBounds, Rect newBounds) => PointAnnotation(
    id: id,
    position: remapPoint(position, oldBounds, newBounds),
    color: color,
    radius: radius,
  );

  @override
  Map<String, dynamic> toJson() => {
    'type': kType,
    'id': id,
    'position': _offsetToJson(position),
    'color': _colorToJson(color),
    'radius': radius,
  };

  factory PointAnnotation.fromJson(Map<String, dynamic> json) =>
      PointAnnotation(
        id: json['id'] as String,
        position: _offsetFromJson(json['position'] as List<dynamic>),
        color: _colorFromJson(json['color'] as int),
        radius: (json['radius'] as num).toDouble(),
      );
}
