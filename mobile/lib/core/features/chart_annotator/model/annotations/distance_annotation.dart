part of '../annotation.dart';

final class DistanceAnnotation extends Annotation {
  const DistanceAnnotation({
    required this.id,
    required this.start,
    required this.end,
    this.color = kDefaultStrokeColor,
    this.strokeWidth = kDefaultStrokeWidth,
  });

  static const String kType = 'distance';

  @override
  final String id;
  final Offset start;
  final Offset end;
  @override
  final Color color;
  @override
  final double strokeWidth;

  double get pixels => distance(start, end);

  @override
  void paint(Canvas canvas) {
    canvas.drawLine(start, end, PaintCache.strokeOf(color, strokeWidth));
    final label = '${pixels.toStringAsFixed(1)} px';
    final mid = midpoint(start, end);
    _paintLabel(canvas, label, mid, color);
  }

  @override
  bool hitTest(Offset p) => pointToSegmentDistance(p, start, end) <= kHitSlop;

  @override
  Rect get boundsInImageSpace => Rect.fromPoints(start, end).inflate(24);

  @override
  DistanceAnnotation translate(Offset delta) => DistanceAnnotation(
    id: id,
    start: start + delta,
    end: end + delta,
    color: color,
    strokeWidth: strokeWidth,
  );

  @override
  DistanceAnnotation resize(Rect oldBounds, Rect newBounds) =>
      DistanceAnnotation(
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

  factory DistanceAnnotation.fromJson(Map<String, dynamic> json) =>
      DistanceAnnotation(
        id: json['id'] as String,
        start: _offsetFromJson(json['start'] as List<dynamic>),
        end: _offsetFromJson(json['end'] as List<dynamic>),
        color: _colorFromJson(json['color'] as int),
        strokeWidth: (json['strokeWidth'] as num).toDouble(),
      );
}

void _paintLabel(Canvas canvas, String text, Offset anchor, Color color) {
  final tp = TextPainter(
    text: TextSpan(
      text: text,
      style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
    ),
    textDirection: TextDirection.ltr,
  )..layout();
  final bg = Rect.fromLTWH(
    anchor.dx - tp.width / 2 - 4,
    anchor.dy - tp.height - 6,
    tp.width + 8,
    tp.height + 4,
  );
  canvas.drawRRect(
    RRect.fromRectAndRadius(bg, const Radius.circular(3)),
    PaintCache.labelBackground,
  );
  tp.paint(canvas, Offset(bg.left + 4, bg.top + 2));
}
