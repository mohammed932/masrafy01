part of '../annotation.dart';

final class ArrowAnnotation extends Annotation {
  const ArrowAnnotation({
    required this.id,
    required this.start,
    required this.end,
    this.color = kDefaultStrokeColor,
    this.strokeWidth = kDefaultStrokeWidth,
  });

  static const String kType = 'arrow';

  @override
  final String id;
  final Offset start;
  final Offset end;
  @override
  final Color color;
  @override
  final double strokeWidth;

  @override
  void paint(Canvas canvas) {
    final paint = PaintCache.strokeOf(color, strokeWidth);
    canvas.drawLine(start, end, paint);
    canvas.drawPath(arrowheadPath(start, end), PaintCache.fillOf(color));
  }

  @override
  bool hitTest(Offset p) => pointToSegmentDistance(p, start, end) <= kHitSlop;

  @override
  Rect get boundsInImageSpace => Rect.fromPoints(start, end).inflate(14);

  @override
  ArrowAnnotation translate(Offset delta) => ArrowAnnotation(
    id: id,
    start: start + delta,
    end: end + delta,
    color: color,
    strokeWidth: strokeWidth,
  );

  @override
  ArrowAnnotation resize(Rect oldBounds, Rect newBounds) => ArrowAnnotation(
    id: id,
    start: remapPoint(start, oldBounds, newBounds),
    end: remapPoint(end, oldBounds, newBounds),
    color: color,
    strokeWidth: strokeWidth,
  );

  @override
  Map<String, dynamic> toJson() => {
    'type': kType,
    'id': id,
    'start': _offsetToJson(start),
    'end': _offsetToJson(end),
    'color': _colorToJson(color),
    'strokeWidth': strokeWidth,
  };

  factory ArrowAnnotation.fromJson(Map<String, dynamic> json) =>
      ArrowAnnotation(
        id: json['id'] as String,
        start: _offsetFromJson(json['start'] as List<dynamic>),
        end: _offsetFromJson(json['end'] as List<dynamic>),
        color: _colorFromJson(json['color'] as int),
        strokeWidth: (json['strokeWidth'] as num).toDouble(),
      );
}
