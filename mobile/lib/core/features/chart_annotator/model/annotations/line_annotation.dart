part of '../annotation.dart';

final class LineAnnotation extends Annotation {
  const LineAnnotation({
    required this.id,
    required this.start,
    required this.end,
    this.color = kDefaultStrokeColor,
    this.strokeWidth = kDefaultStrokeWidth,
  });

  static const String kType = 'line';

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
    canvas.drawLine(start, end, PaintCache.strokeOf(color, strokeWidth));
  }

  @override
  bool hitTest(Offset p) => pointToSegmentDistance(p, start, end) <= kHitSlop;

  @override
  Rect get boundsInImageSpace => Rect.fromPoints(start, end).inflate(4);

  @override
  LineAnnotation translate(Offset delta) => LineAnnotation(
    id: id,
    start: start + delta,
    end: end + delta,
    color: color,
    strokeWidth: strokeWidth,
  );

  @override
  LineAnnotation resize(Rect oldBounds, Rect newBounds) => LineAnnotation(
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

  factory LineAnnotation.fromJson(Map<String, dynamic> json) => LineAnnotation(
    id: json['id'] as String,
    start: _offsetFromJson(json['start'] as List<dynamic>),
    end: _offsetFromJson(json['end'] as List<dynamic>),
    color: _colorFromJson(json['color'] as int),
    strokeWidth: (json['strokeWidth'] as num).toDouble(),
  );
}
