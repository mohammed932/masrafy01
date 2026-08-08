import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui';

import 'package:image/image.dart' as img;

import 'package:app/core/utils/image_pick.dart';

/// Everything [cropCapturedIdFrame] needs, in one payload so it can cross the
/// isolate boundary in a single `compute` call.
class IdCropRequest {
  const IdCropRequest({
    required this.bytes,
    required this.viewport,
    required this.frame,
    required this.profile,
  });

  /// Raw JPEG bytes straight from `CameraController.takePicture()`.
  final Uint8List bytes;

  /// Logical size of the full-screen preview the user was aiming with.
  final Size viewport;

  /// The cutout rectangle inside [viewport] (see `idFrameRect`).
  final Rect frame;

  /// Output budget. `document` keeps the ID number legible for manual review.
  final ImagePickProfile profile;
}

/// Crops a captured camera frame down to the on-screen ID cutout.
///
/// Top-level so it can run through `compute` — decoding a multi-megapixel JPEG
/// on the UI isolate janks the shutter animation.
///
/// The mapping mirrors how the preview is displayed: the sensor image is drawn
/// `BoxFit.cover` into the viewport, so it is scaled by `max(sw/iw, sh/ih)` and
/// centre-cropped. Inverting that scale + offset turns cutout coordinates back
/// into source-image pixels. Getting this wrong is invisible on a square-ish
/// device and badly off on a tall one, which is why the same [IdCropRequest]
/// carries the viewport the user actually aimed with rather than re-deriving it.
///
/// Returns `null` when the bytes cannot be decoded; the caller surfaces that as
/// a retryable capture failure rather than uploading an unusable file.
Uint8List? cropCapturedIdFrame(IdCropRequest request) {
  final decoded = img.decodeImage(request.bytes);
  if (decoded == null) return null;

  // EXIF is metadata, not pixels: the preview honours it but `copyCrop` does
  // not, so an un-baked portrait capture would be cropped as if landscape.
  final source = img.bakeOrientation(decoded);

  final viewport = request.viewport;
  final scale = math.max(
    viewport.width / source.width,
    viewport.height / source.height,
  );
  final dx = ((source.width * scale) - viewport.width) / 2;
  final dy = ((source.height * scale) - viewport.height) / 2;

  final frame = request.frame;
  final left = ((frame.left + dx) / scale).round();
  final top = ((frame.top + dy) / scale).round();
  final width = (frame.width / scale).round();
  final height = (frame.height / scale).round();

  // Rounding at the edges can push the rect a pixel past the bitmap; clamp so
  // `copyCrop` never reads out of bounds.
  final x = left.clamp(0, source.width - 1);
  final y = top.clamp(0, source.height - 1);
  final w = width.clamp(1, source.width - x);
  final h = height.clamp(1, source.height - y);

  var cropped = img.copyCrop(source, x: x, y: y, width: w, height: h);

  final maxEdge = request.profile.maxEdge.round();
  if (math.max(cropped.width, cropped.height) > maxEdge) {
    cropped = img.copyResize(
      cropped,
      width: cropped.width >= cropped.height ? maxEdge : null,
      height: cropped.height > cropped.width ? maxEdge : null,
      interpolation: img.Interpolation.average,
    );
  }

  return img.encodeJpg(cropped, quality: request.profile.quality);
}
