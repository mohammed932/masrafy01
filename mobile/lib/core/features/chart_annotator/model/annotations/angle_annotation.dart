part of '../annotation.dart';

final class AngleAnnotation extends Annotation {
  const AngleAnnotation({
    required this.id,
    required this.vertex,
    required this.rayA,
    required this.rayB,
    this.color = kDefaultStrokeColor,
    this.strokeWidth = kDefaultStrokeWidth,
  });

  static const String kType = 'angle';

  @override
  final String id;
  final Offset vertex;
  final Offset rayA;
  final Offset rayB;
  @override
  final Color color;
  @override
  final double strokeWidth;

  double get degrees => angleDegrees(vertex, rayA, rayB);

  @override
  void paint(Canvas canvas) {
    final stroke = PaintCache.strokeOf(color, strokeWidth);
    canvas.drawLine(vertex, rayA, stroke);
    canvas.drawLine(vertex, rayB, stroke);

    final lenA = distance(vertex, rayA);
    final lenB = distance(vertex, rayB);
    final radius = (lenA < lenB ? lenA : lenB) * 0.25;
    if (radius < 4) return;
    final a1 = math.atan2(rayA.dy - vertex.dy, rayA.dx - vertex.dx);
    final a2 = math.atan2(rayB.dy - vertex.dy, rayB.dx - vertex.dx);
    var sweep = a2 - a1;
    if (sweep > math.pi) sweep -= 2 * math.pi;
    if (sweep < -math.pi) sweep += 2 * math.pi;
    canvas.drawArc(
      Rect.fromCircle(center: vertex, radius: radius),
      a1,
      sweep,
      false,
      stroke,
    );

    final midAngle = a1 + sweep / 2;
    final labelPos = Offset(
      vertex.dx + (radius + 20) * math.cos(midAngle),
      vertex.dy + (radius + 20) * math.sin(midAngle),
    );
    _paintAngleLabel(canvas, '${degrees.toStringAsFixed(1)}°', labelPos, color);
  }

  @override
  bool hitTest(Offset p) =>
      pointToSegmentDistance(p, vertex, rayA) <= kHitSlop ||
      pointToSegmentDistance(p, vertex, rayB) <= kHitSlop;

  @override
  Rect get boundsInImageSpace {
    final xs = [vertex.dx, rayA.dx, rayB.dx];
    final ys = [vertex.dy, rayA.dy, rayB.dy];
    return Rect.fromLTRB(
      xs.reduce(math.min) - 24,
      ys.reduce(math.min) - 24,
      xs.reduce(math.max) + 24,
      ys.reduce(math.max) + 24,
    );
  }

  @override
  AngleAnnotation translate(Offset delta) => AngleAnnotation(
    id: id,
    vertex: vertex + delta,
    rayA: rayA + delta,
    rayB: rayB + delta,
    color: color,
    strokeWidth: strokeWidth,
  );

  @override
  AngleAnnotation resize(Rect oldBounds, Rect newBounds) => AngleAnnotation(
    id: id,
    vertex: remapPoint(vertex, oldBounds, newBounds),
    rayA: remapPoint(rayA, oldBounds, newBounds),
    rayB: remapPoint(rayB, oldBounds, newBounds),
    color: color,
    strokeWidth: strokeWidth,
  );

  @override
  Map<String, dynamic> toJson() => {
    'type': kType,
    'id': id,
    'vertex': _offsetToJson(vertex),
    'rayA': _offsetToJson(rayA),
    'rayB': _offsetToJson(rayB),
    'color': _colorToJson(color),
    'strokeWidth': strokeWidth,
  };

  factory AngleAnnotation.fromJson(Map<String, dynamic> json) =>
      AngleAnnotation(
        id: json['id'] as String,
        vertex: _offsetFromJson(json['vertex'] as List<dynamic>),
        rayA: _offsetFromJson(json['rayA'] as List<dynamic>),
        rayB: _offsetFromJson(json['rayB'] as List<dynamic>),
        color: _colorFromJson(json['color'] as int),
        strokeWidth: (json['strokeWidth'] as num).toDouble(),
      );
}

void _paintAngleLabel(Canvas canvas, String text, Offset anchor, Color color) {
  final tp = TextPainter(
    text: TextSpan(
      text: text,
      style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
    ),
    textDirection: TextDirection.ltr,
  )..layout();
  final bg = Rect.fromLTWH(
    anchor.dx - tp.width / 2 - 4,
    anchor.dy - tp.height / 2 - 2,
    tp.width + 8,
    tp.height + 4,
  );
  canvas.drawRRect(
    RRect.fromRectAndRadius(bg, const Radius.circular(3)),
    PaintCache.labelBackground,
  );
  tp.paint(canvas, Offset(bg.left + 4, bg.top + 2));
}
