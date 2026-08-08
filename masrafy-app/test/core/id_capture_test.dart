import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;

import 'package:app/core/features/id_capture/id_capture_side.dart';
import 'package:app/core/features/id_capture/id_frame_geometry.dart';
import 'package:app/core/features/id_capture/id_image_crop.dart';
import 'package:app/core/utils/image_pick.dart';

/// A synthetic "camera frame": a solid background with a distinctly coloured
/// block placed exactly where the cutout maps back to. If the crop math is
/// right the output is entirely that block; if it drifts, background bleeds in.
Uint8List _frameWithMarker({
  required int width,
  required int height,
  required Size viewport,
}) {
  final image = img.Image(width: width, height: height);
  img.fill(image, color: img.ColorRgb8(20, 20, 20));

  final rect = idFrameRect(viewport);

  // Forward mapping, derived independently of the production code: under
  // `BoxFit.cover` the visible slice of the source is `viewport × pxPerVp`
  // source pixels, centred — so one viewport pixel is `pxPerVp` source pixels
  // and the slice starts at `offset`.
  final pxPerVp = width / viewport.width < height / viewport.height
      ? width / viewport.width
      : height / viewport.height;
  final offsetX = (width - (viewport.width * pxPerVp)) / 2;
  final offsetY = (height - (viewport.height * pxPerVp)) / 2;

  img.fillRect(
    image,
    x1: (offsetX + (rect.left * pxPerVp)).round(),
    y1: (offsetY + (rect.top * pxPerVp)).round(),
    x2: (offsetX + (rect.right * pxPerVp)).round(),
    y2: (offsetY + (rect.bottom * pxPerVp)).round(),
    color: img.ColorRgb8(230, 40, 40),
  );
  return Uint8List.fromList(img.encodeJpg(image, quality: 100));
}

void main() {
  group('idFrameRect', () {
    test('is centred horizontally and keeps the ID-1 card ratio', () {
      const viewport = Size(393, 852);
      final rect = idFrameRect(viewport);

      expect(rect.left, closeTo(viewport.width - rect.right, 0.001));
      expect(rect.width / rect.height, closeTo(idCardAspectRatio, 0.001));
      expect(rect.left, greaterThan(0));
      expect(rect.right, lessThan(viewport.width));
    });

    test('falls back to height-driven sizing on a short viewport', () {
      // A landscape-ish viewport: width-driven sizing would overflow the
      // height budget, so the rect must shrink and stay inside the viewport.
      const viewport = Size(800, 360);
      final rect = idFrameRect(viewport);

      expect(rect.width / rect.height, closeTo(idCardAspectRatio, 0.001));
      expect(rect.height, lessThanOrEqualTo(viewport.height * 0.55 + 0.001));
      expect(rect.top, greaterThanOrEqualTo(0));
      expect(rect.bottom, lessThanOrEqualTo(viewport.height));
    });
  });

  group('cropCapturedIdFrame', () {
    const viewport = Size(393, 852);

    test('crops to the cutout and keeps the card ratio', () {
      final bytes = _frameWithMarker(width: 1080, height: 1920, viewport: viewport);

      final out = cropCapturedIdFrame(IdCropRequest(
        bytes: bytes,
        viewport: viewport,
        frame: idFrameRect(viewport),
        profile: ImagePickProfile.document,
      ));

      expect(out, isNotNull);
      final decoded = img.decodeImage(out!)!;
      expect(decoded.width / decoded.height, closeTo(idCardAspectRatio, 0.05));
    });

    test('output holds the marker, not the surrounding frame', () {
      final bytes = _frameWithMarker(width: 1080, height: 1920, viewport: viewport);

      final out = cropCapturedIdFrame(IdCropRequest(
        bytes: bytes,
        viewport: viewport,
        frame: idFrameRect(viewport),
        profile: ImagePickProfile.document,
      ))!;
      final decoded = img.decodeImage(out)!;

      // Centre must be marker red; a mis-mapped crop would land on the
      // near-black background instead.
      final centre = decoded.getPixel(decoded.width ~/ 2, decoded.height ~/ 2);
      expect(centre.r, greaterThan(150));
      expect(centre.g, lessThan(120));
    });

    test('respects the document size budget', () {
      final bytes = _frameWithMarker(width: 2160, height: 3840, viewport: viewport);

      final out = cropCapturedIdFrame(IdCropRequest(
        bytes: bytes,
        viewport: viewport,
        frame: idFrameRect(viewport),
        profile: ImagePickProfile.document,
      ))!;
      final decoded = img.decodeImage(out)!;

      final longest =
          decoded.width > decoded.height ? decoded.width : decoded.height;
      expect(longest, lessThanOrEqualTo(ImagePickProfile.document.maxEdge));
      expect(out.length, lessThanOrEqualTo(ImagePickProfile.document.maxBytes));
    });

    test('the request survives the isolate hop', () async {
      // The crop runs through `compute` on device; a payload field that is not
      // sendable would only blow up there, at shutter time.
      final bytes =
          _frameWithMarker(width: 1080, height: 1920, viewport: viewport);

      final out = await compute(
        cropCapturedIdFrame,
        IdCropRequest(
          bytes: bytes,
          viewport: viewport,
          frame: idFrameRect(viewport),
          profile: ImagePickProfile.document,
        ),
      );

      expect(out, isNotNull);
    });

    test('undecodable bytes are reported, not uploaded', () {
      final out = cropCapturedIdFrame(IdCropRequest(
        bytes: Uint8List.fromList(List.filled(64, 0)),
        viewport: viewport,
        frame: idFrameRect(viewport),
        profile: ImagePickProfile.document,
      ));

      expect(out, isNull);
    });
  });

  test('IdCaptureSide tags the uploaded filename', () {
    expect(IdCaptureSide.front.filename, 'national_id_front.jpg');
    expect(IdCaptureSide.back.filename, 'national_id_back.jpg');
  });
}
