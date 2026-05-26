part of '../annotation.dart';

final class TextAnnotation extends Annotation {
  const TextAnnotation({
    required this.id,
    required this.position,
    required this.text,
    this.color = kDefaultStrokeColor,
    this.fontSize = 16,
  });

  static const String kType = 'text';

  @override
  final String id;
  final Offset position;
  final String text;
  @override
  final Color color;
  final double fontSize;

  @override
  double get strokeWidth => 1;

  TextPainter _layout() => TextPainter(
    text: TextSpan(
      text: text,
      style: TextStyle(
        color: color,
        fontSize: fontSize,
        fontWeight: FontWeight.w600,
      ),
    ),
    textDirection: TextDirection.ltr,
  )..layout();

  @override
  void paint(Canvas canvas) {
    if (text.isEmpty) return;
    final tp = _layout();
    tp.paint(canvas, position);
  }

  @override
  bool hitTest(Offset p) => boundsInImageSpace.contains(p);

  @override
  Rect get boundsInImageSpace {
    if (text.isEmpty) {
      return Rect.fromLTWH(position.dx, position.dy, fontSize, fontSize);
    }
    final tp = _layout();
    return Rect.fromLTWH(
      position.dx - 2,
      position.dy - 2,
      tp.width + 4,
      tp.height + 4,
    );
  }

  @override
  TextAnnotation translate(Offset delta) => TextAnnotation(
    id: id,
    position: position + delta,
    text: text,
    color: color,
    fontSize: fontSize,
  );

  @override
  TextAnnotation resize(Rect oldBounds, Rect newBounds) {
    final scale = newBounds.height == 0 || oldBounds.height == 0
        ? 1.0
        : newBounds.height / oldBounds.height;
    return TextAnnotation(
      id: id,
      position: remapPoint(position, oldBounds, newBounds),
      text: text,
      color: color,
      fontSize: (fontSize * scale).clamp(8, 96),
    );
  }

  TextAnnotation copyWith({String? text}) => TextAnnotation(
    id: id,
    position: position,
    text: text ?? this.text,
    color: color,
    fontSize: fontSize,
  );

  @override
  Map<String, dynamic> toJson() => {
    'type': kType,
    'id': id,
    'position': _offsetToJson(position),
    'text': text,
    'color': _colorToJson(color),
    'fontSize': fontSize,
  };

  factory TextAnnotation.fromJson(Map<String, dynamic> json) => TextAnnotation(
    id: json['id'] as String,
    position: _offsetFromJson(json['position'] as List<dynamic>),
    text: json['text'] as String,
    color: _colorFromJson(json['color'] as int),
    fontSize: (json['fontSize'] as num).toDouble(),
  );
}
