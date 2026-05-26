part of '../annotation.dart';

/// Persistent dashed-cross marker — dashed horizontal + vertical line through
/// [position] with a 5px filled centre dot and an `(x, y)` coordinate label.
/// Origin for the readout is `image-centre`; positive y is downward in image
/// space, so the displayed `y` is negated to match the screen-up convention.
final class CrosshairAnnotation extends Annotation {
  const CrosshairAnnotation({
    required this.id,
    required this.position,
    this.color = kDefaultStrokeColor,
    this.imageSize = Size.zero,
  });

  static const String kType = 'crosshair';

  @override
  final String id;
  final Offset position;
  @override
  final Color color;

  /// Decoded image dimensions used for the centred coordinate label. Pass
  /// `Size.zero` when unknown — the label then reports raw image-space coords.
  final Size imageSize;

  @override
  double get strokeWidth => 1;

  @override
  void paint(Canvas canvas) {
    final stroke = PaintCache.strokeOf(color, 1);
    _dashedLine(
      canvas,
      Offset(position.dx - 5000, position.dy),
      Offset(position.dx + 5000, position.dy),
      stroke,
    );
    _dashedLine(
      canvas,
      Offset(position.dx, position.dy - 5000),
      Offset(position.dx, position.dy + 5000),
      stroke,
    );
    canvas.drawCircle(position, 5, PaintCache.fillOf(color));

    final origin = imageSize == Size.zero
        ? Offset.zero
        : Offset(imageSize.width / 2, imageSize.height / 2);
    final coord = Offset(
      position.dx - origin.dx,
      origin.dy - position.dy,
    );
    final label =
        '(${coord.dx.toStringAsFixed(0)}, ${coord.dy.toStringAsFixed(0)})';
    final tp = TextPainter(
      text: TextSpan(
        text: label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final bg = Rect.fromLTWH(
      position.dx + 12 - 4,
      position.dy - 24 - 2,
      tp.width + 8,
      tp.height + 4,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(bg, const Radius.circular(3)),
      PaintCache.labelBackground,
    );
    tp.paint(canvas, Offset(bg.left + 4, bg.top + 2));
  }

  void _dashedLine(Canvas canvas, Offset a, Offset b, Paint paint) {
    const dash = 8.0;
    const gap = 5.0;
    final dir = b - a;
    final length = dir.distance;
    if (length == 0) return;
    final unit = Offset(dir.dx / length, dir.dy / length);
    var travelled = 0.0;
    while (travelled < length) {
      final segStart = a + unit * travelled;
      final segEnd =
          a + unit * (travelled + dash > length ? length : travelled + dash);
      canvas.drawLine(segStart, segEnd, paint);
      travelled += dash + gap;
    }
  }

  @override
  bool hitTest(Offset p) => (p - position).distance <= 12;

  @override
  Rect get boundsInImageSpace =>
      Rect.fromCircle(center: position, radius: 24);

  @override
  CrosshairAnnotation translate(Offset delta) => CrosshairAnnotation(
    id: id,
    position: position + delta,
    color: color,
    imageSize: imageSize,
  );

  @override
  CrosshairAnnotation resize(Rect oldBounds, Rect newBounds) =>
      CrosshairAnnotation(
        id: id,
        position: remapPoint(position, oldBounds, newBounds),
        color: color,
        imageSize: imageSize,
      );

  @override
  Map<String, dynamic> toJson() => {
    'type': kType,
    'id': id,
    'position': _offsetToJson(position),
    'color': _colorToJson(color),
    'imageW': imageSize.width,
    'imageH': imageSize.height,
  };

  factory CrosshairAnnotation.fromJson(Map<String, dynamic> json) =>
      CrosshairAnnotation(
        id: json['id'] as String,
        position: _offsetFromJson(json['position'] as List<dynamic>),
        color: _colorFromJson(json['color'] as int),
        imageSize: Size(
          (json['imageW'] as num).toDouble(),
          (json['imageH'] as num).toDouble(),
        ),
      );
}
