import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';

import '../util/geometry.dart';
import '../util/paint_cache.dart';

part 'annotations/angle_annotation.dart';
part 'annotations/arrow_annotation.dart';
part 'annotations/crosshair_annotation.dart';
part 'annotations/distance_annotation.dart';
part 'annotations/ellipse_annotation.dart';
part 'annotations/line_annotation.dart';
part 'annotations/perpendicular_annotation.dart';
part 'annotations/point_annotation.dart';
part 'annotations/text_annotation.dart';

const Color kDefaultStrokeColor = Color(0xFFB22222);
const double kDefaultStrokeWidth = 2;
const double kHitSlop = 8;

/// Sealed base for every persistent annotation type.
///
/// All coordinates are in **image space** — the drawing layers apply the
/// current viewport `Matrix4` at paint time. Subclasses are immutable: any
/// state mutation returns a new instance.
sealed class Annotation {
  const Annotation();

  /// Stable identifier — used for hit-test caching and JSON round-trip.
  String get id;

  /// Stroke colour applied to outlines and label text.
  Color get color;

  /// Stroke width in image-space pixels.
  double get strokeWidth;

  /// Render the annotation onto [canvas] in image-space coordinates. The
  /// caller has already applied the viewport transform.
  void paint(Canvas canvas);

  /// `true` when [imageSpacePoint] lies on or inside the visual envelope of
  /// the annotation. Used by `SelectHandler`.
  bool hitTest(Offset imageSpacePoint);

  /// Axis-aligned bounding rect in image space — drives selection handles.
  Rect get boundsInImageSpace;

  /// Returns a translated copy. Pure — does not mutate `this`.
  Annotation translate(Offset delta);

  /// Returns a copy where every internal coordinate has been linearly
  /// remapped from [oldBounds] to [newBounds]. Default implementation rescales
  /// every `Offset` field through [remapPoint]; subclasses that own a `Rect`
  /// (Ellipse) override for direct mapping.
  Annotation resize(Rect oldBounds, Rect newBounds);

  /// Wire-format payload. Discriminator field MUST be `"type"`.
  Map<String, dynamic> toJson();
}

/// Linearly remaps [point] from [oldBounds] to [newBounds] so resize handles
/// drag the annotation's geometry coherently.
Offset remapPoint(Offset point, Rect oldBounds, Rect newBounds) {
  final oldW = oldBounds.width == 0 ? 1 : oldBounds.width;
  final oldH = oldBounds.height == 0 ? 1 : oldBounds.height;
  final tx = (point.dx - oldBounds.left) / oldW;
  final ty = (point.dy - oldBounds.top) / oldH;
  return Offset(
    newBounds.left + tx * newBounds.width,
    newBounds.top + ty * newBounds.height,
  );
}

Rect remapRect(Rect rect, Rect oldBounds, Rect newBounds) => Rect.fromPoints(
  remapPoint(rect.topLeft, oldBounds, newBounds),
  remapPoint(rect.bottomRight, oldBounds, newBounds),
);

/// Decodes any annotation from its JSON map. Throws if `type` is unknown.
Annotation annotationFromJson(Map<String, dynamic> json) {
  final type = json['type'] as String;
  return switch (type) {
    LineAnnotation.kType => LineAnnotation.fromJson(json),
    ArrowAnnotation.kType => ArrowAnnotation.fromJson(json),
    PointAnnotation.kType => PointAnnotation.fromJson(json),
    EllipseAnnotation.kType => EllipseAnnotation.fromJson(json),
    DistanceAnnotation.kType => DistanceAnnotation.fromJson(json),
    AngleAnnotation.kType => AngleAnnotation.fromJson(json),
    PerpendicularAnnotation.kType => PerpendicularAnnotation.fromJson(json),
    CrosshairAnnotation.kType => CrosshairAnnotation.fromJson(json),
    TextAnnotation.kType => TextAnnotation.fromJson(json),
    _ => throw FormatException('Unknown annotation type: $type'),
  };
}

/// Inert annotation used only by unit tests. Lives inside this library so the
/// `sealed` constraint on [Annotation] is satisfied without dragging
/// production subclasses into the test binary.
@visibleForTesting
final class DebugAnnotation extends Annotation {
  const DebugAnnotation(this.id);

  @override
  final String id;

  @override
  Color get color => kDefaultStrokeColor;

  @override
  double get strokeWidth => kDefaultStrokeWidth;

  @override
  void paint(Canvas canvas) {}

  @override
  bool hitTest(Offset imageSpacePoint) => false;

  @override
  Rect get boundsInImageSpace => Rect.zero;

  @override
  Annotation translate(Offset delta) => this;

  @override
  Annotation resize(Rect oldBounds, Rect newBounds) => this;

  @override
  Map<String, dynamic> toJson() => {'type': 'debug', 'id': id};
}

Offset _offsetFromJson(List<dynamic> json) =>
    Offset((json[0] as num).toDouble(), (json[1] as num).toDouble());

List<double> _offsetToJson(Offset o) => [o.dx, o.dy];

Color _colorFromJson(int v) => Color(v);

int _colorToJson(Color c) =>
    (((c.a * 255).round() & 0xff) << 24) |
    (((c.r * 255).round() & 0xff) << 16) |
    (((c.g * 255).round() & 0xff) << 8) |
    ((c.b * 255).round() & 0xff);
