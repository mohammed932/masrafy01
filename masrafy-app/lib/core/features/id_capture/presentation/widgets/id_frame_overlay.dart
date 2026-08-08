import 'package:flutter/material.dart';

import 'package:app/core/features/id_capture/id_frame_geometry.dart';

/// Dimming scrim with a transparent, ID-card-shaped cutout plus corner
/// brackets — the aiming guide painted over the live camera preview.
///
/// Purely decorative: it never intercepts a tap, so the shutter and the close
/// button underneath keep working (`IgnorePointer` at the call site is not
/// needed because this widget is not hit-testable on its own).
class IdFrameOverlay extends StatelessWidget {
  const IdFrameOverlay({
    super.key,
    required this.scrimColor,
    required this.frameColor,
    this.accentColor,
  });

  /// Fill painted everywhere except the cutout.
  final Color scrimColor;

  /// Hairline around the cutout.
  final Color frameColor;

  /// Corner brackets. Falls back to [frameColor] when null.
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: CustomPaint(
        size: Size.infinite,
        painter: _IdFramePainter(
          scrimColor: scrimColor,
          frameColor: frameColor,
          accentColor: accentColor ?? frameColor,
        ),
      ),
    );
  }
}

class _IdFramePainter extends CustomPainter {
  const _IdFramePainter({
    required this.scrimColor,
    required this.frameColor,
    required this.accentColor,
  });

  final Color scrimColor;
  final Color frameColor;
  final Color accentColor;

  /// Visible length of each corner bracket arm, in logical pixels.
  static const double _bracketArm = 28;
  static const double _bracketStroke = 3.5;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = idFrameRect(size);
    final rrect = RRect.fromRectAndRadius(
      rect,
      const Radius.circular(idFrameCornerRadius),
    );

    // Scrim = whole viewport minus the cutout, so the preview shows through
    // only inside the card.
    final scrim = Path.combine(
      PathOperation.difference,
      Path()..addRect(Offset.zero & size),
      Path()..addRRect(rrect),
    );
    canvas.drawPath(scrim, Paint()..color = scrimColor);

    canvas.drawRRect(
      rrect,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = frameColor,
    );

    final bracket = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = _bracketStroke
      ..strokeCap = StrokeCap.round
      ..color = accentColor;

    // Arms start past the rounded corner so the bracket reads as a right angle
    // rather than tracing the radius.
    const r = idFrameCornerRadius;
    final path = Path()
      // top-left
      ..moveTo(rect.left, rect.top + r + _bracketArm)
      ..lineTo(rect.left, rect.top + r)
      ..arcToPoint(
        Offset(rect.left + r, rect.top),
        radius: const Radius.circular(r),
      )
      ..lineTo(rect.left + r + _bracketArm, rect.top)
      // top-right
      ..moveTo(rect.right - r - _bracketArm, rect.top)
      ..lineTo(rect.right - r, rect.top)
      ..arcToPoint(
        Offset(rect.right, rect.top + r),
        radius: const Radius.circular(r),
      )
      ..lineTo(rect.right, rect.top + r + _bracketArm)
      // bottom-right
      ..moveTo(rect.right, rect.bottom - r - _bracketArm)
      ..lineTo(rect.right, rect.bottom - r)
      ..arcToPoint(
        Offset(rect.right - r, rect.bottom),
        radius: const Radius.circular(r),
      )
      ..lineTo(rect.right - r - _bracketArm, rect.bottom)
      // bottom-left
      ..moveTo(rect.left + r + _bracketArm, rect.bottom)
      ..lineTo(rect.left + r, rect.bottom)
      ..arcToPoint(
        Offset(rect.left, rect.bottom - r),
        radius: const Radius.circular(r),
      )
      ..lineTo(rect.left, rect.bottom - r - _bracketArm);

    canvas.drawPath(path, bracket);
  }

  @override
  bool shouldRepaint(_IdFramePainter old) =>
      old.scrimColor != scrimColor ||
      old.frameColor != frameColor ||
      old.accentColor != accentColor;
}
