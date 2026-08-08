import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// Profile-photo upload affordance (Figma `91:349`): a 128px dashed-border
/// circle with a camera glyph + "Upload" label. When [imageBytes] is provided
/// the just-picked photo fills the circle; [uploading] shows a spinner overlay;
/// [uploaded] (without bytes) renders a done state for a photo already on file
/// (e.g. fetched from the documents-status pre-check). [onTap] picks/uploads.
///
/// Shared core widget (Principle XXXIII) — used by signup, complete-profile,
/// and the apply-documents screen.
class MasrafyPhotoUpload extends StatelessWidget {
  const MasrafyPhotoUpload({
    super.key,
    required this.label,
    this.onTap,
    this.imageBytes,
    this.uploading = false,
    this.uploaded = false,
  });

  final String label;
  final VoidCallback? onTap;

  /// Picked photo bytes — when set, rendered inside the circle.
  final Uint8List? imageBytes;

  /// Shows a progress overlay while the upload is in flight.
  final bool uploading;

  /// Renders a done state when the photo is already on file but no local
  /// bytes are held (pre-checked from the backend).
  final bool uploaded;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final hasImage = imageBytes != null;
    final isDone = uploaded && !hasImage;

    return Center(
      child: GestureDetector(
        onTap: uploading ? null : onTap,
        behavior: HitTestBehavior.opaque,
        child: CustomPaint(
          painter: _DashedCirclePainter(
            color: isDone ? colors.success.main : colors.secondary.main,
          ),
          child: Container(
            width: 128.r,
            height: 128.r,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: colors.secondary.main.withValues(alpha: 0.12),
              image: hasImage
                  ? DecorationImage(
                      // Decode at the painted size — the circle is 128 logical
                      // px, so the full-resolution bitmap never needs to be
                      // held in the image cache.
                      image: ResizeImage(
                        MemoryImage(imageBytes!),
                        width: (128.r * MediaQuery.devicePixelRatioOf(context))
                            .round(),
                      ),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            child: uploading
                ? Center(
                    child: SizedBox(
                      width: 24.r,
                      height: 24.r,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: colors.secondary.main,
                      ),
                    ),
                  )
                : hasImage
                    ? Align(
                        alignment: AlignmentDirectional.bottomCenter,
                        child: Container(
                          width: double.infinity,
                          color: colors.secondary.main.withValues(alpha: 0.85),
                          padding: EdgeInsets.symmetric(vertical: 4.h),
                          child: Icon(
                            Icons.edit_outlined,
                            size: 16.r,
                            color: colors.white,
                          ),
                        ),
                      )
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            isDone
                                ? Icons.check_circle
                                : Icons.add_a_photo_outlined,
                            size: 26.r,
                            color: isDone
                                ? colors.success.main
                                : colors.secondary.main,
                          ),
                          Gap(4.h),
                          Text(
                            label,
                            style: text.caption.medium().copyWith(
                                  color: isDone
                                      ? colors.success.main
                                      : colors.secondary.main,
                                ),
                          ),
                        ],
                      ),
          ),
        ),
      ),
    );
  }
}

/// Strokes a dashed ring around the photo circle (Flutter has no dashed
/// border primitive).
class _DashedCirclePainter extends CustomPainter {
  _DashedCirclePainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color.withValues(alpha: 0.5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    final radius = size.width / 2;
    final center = Offset(radius, radius);
    const dashCount = 36;
    const sweep = (2 * math.pi) / dashCount;
    const gapRatio = 0.45;
    for (var i = 0; i < dashCount; i++) {
      final start = i * sweep;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius - 1),
        start,
        sweep * (1 - gapRatio),
        false,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_DashedCirclePainter oldDelegate) =>
      oldDelegate.color != color;
}
