part of '../annotation.dart';

/// Axis-snapped straight line. Matches the Angular `attachment-editor.component`
/// "perpendicular" tool: a single drag whose end-point is locked to whichever
/// axis the user moved more (horizontal if `|dx| > |dy|`, else vertical).
final class PerpendicularAnnotation extends Annotation {
  const PerpendicularAnnotation({
    required this.id,
    required this.start,
    required this.end,
    this.color = kDefaultStrokeColor,
    this.strokeWidth = kDefaultStrokeWidth,
  });

  static const String kType = 'perpendicular';

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
  PerpendicularAnnotation translate(Offset delta) => PerpendicularAnnotation(
    id: id,
    start: start + delta,
    end: end + delta,
    color: color,
    strokeWidth: strokeWidth,
  );

  @override
  PerpendicularAnnotation resize(Rect oldBounds, Rect newBounds) =>
      PerpendicularAnnotation(
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

  factory PerpendicularAnnotation.fromJson(Map<String, dynamic> json) =>
      PerpendicularAnnotation(
        id: json['id'] as String,
        start: _offsetFromJson(json['start'] as List<dynamic>),
        end: _offsetFromJson(json['end'] as List<dynamic>),
        color: _colorFromJson(json['color'] as int),
        strokeWidth: (json['strokeWidth'] as num).toDouble(),
      );
}
