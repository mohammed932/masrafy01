import 'dart:math' as math;
import 'dart:ui';

/// Smaller of the two angles (in degrees) at [vertex] formed by rays
/// `vertex→p1` and `vertex→p2`. Result is in `[0, 180]`.
double angleDegrees(Offset vertex, Offset p1, Offset p2) {
  final v1 = p1 - vertex;
  final v2 = p2 - vertex;
  final a1 = math.atan2(v1.dy, v1.dx);
  final a2 = math.atan2(v2.dy, v2.dx);
  var diff = (a2 - a1).abs() * 180 / math.pi;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/// Euclidean distance between [a] and [b].
double distance(Offset a, Offset b) => (b - a).distance;

/// Drops a perpendicular from [point] to the infinite line through
/// [lineStart] and [lineEnd]. Returns the foot of the perpendicular on the
/// line.
Offset perpendicularFoot(Offset lineStart, Offset lineEnd, Offset point) {
  final dir = lineEnd - lineStart;
  final lenSq = dir.dx * dir.dx + dir.dy * dir.dy;
  if (lenSq == 0) return lineStart;
  final t =
      ((point.dx - lineStart.dx) * dir.dx +
          (point.dy - lineStart.dy) * dir.dy) /
      lenSq;
  return Offset(lineStart.dx + t * dir.dx, lineStart.dy + t * dir.dy);
}

/// Perpendicular (right-angle) distance from [point] to the infinite line
/// through [lineStart] and [lineEnd].
double pointToLineDistance(Offset point, Offset lineStart, Offset lineEnd) {
  final foot = perpendicularFoot(lineStart, lineEnd, point);
  return distance(point, foot);
}

/// Distance from [point] to the segment `[a, b]` — accounts for the
/// closest-endpoint case when the perpendicular foot lies outside.
double pointToSegmentDistance(Offset point, Offset a, Offset b) {
  final dir = b - a;
  final lenSq = dir.dx * dir.dx + dir.dy * dir.dy;
  if (lenSq == 0) return distance(point, a);
  var t = ((point.dx - a.dx) * dir.dx + (point.dy - a.dy) * dir.dy) / lenSq;
  t = t.clamp(0.0, 1.0);
  return distance(point, Offset(a.dx + t * dir.dx, a.dy + t * dir.dy));
}

/// Midpoint of [a] and [b].
Offset midpoint(Offset a, Offset b) =>
    Offset((a.dx + b.dx) / 2, (a.dy + b.dy) / 2);

/// Standard arrowhead path: filled isoceles triangle at [head] aligned with
/// the line from [tail] to [head]. Returns the [Path] ready to draw.
Path arrowheadPath(
  Offset tail,
  Offset head, {
  double length = 12,
  double spread = math.pi / 6,
}) {
  final dir = math.atan2(head.dy - tail.dy, head.dx - tail.dx);
  final left = Offset(
    head.dx - length * math.cos(dir - spread),
    head.dy - length * math.sin(dir - spread),
  );
  final right = Offset(
    head.dx - length * math.cos(dir + spread),
    head.dy - length * math.sin(dir + spread),
  );
  return Path()
    ..moveTo(head.dx, head.dy)
    ..lineTo(left.dx, left.dy)
    ..lineTo(right.dx, right.dy)
    ..close();
}
