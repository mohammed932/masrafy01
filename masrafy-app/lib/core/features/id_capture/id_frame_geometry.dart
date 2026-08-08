/// Geometry of the National-ID capture frame.
///
/// Lives outside the widget layer because THREE things must agree on the exact
/// same rectangle or the crop silently drifts from what the user aimed at:
/// the scrim painter that draws the cutout, the page that reports the viewport,
/// and the isolate that crops the captured frame. One function, one truth.
library;

import 'dart:ui';

/// ISO/IEC 7810 ID-1 — the physical Egyptian National ID card is
/// 85.60 × 53.98 mm. The cutout uses the real ratio so a card that visually
/// fills the frame also fills the cropped image.
const double idCardAspectRatio = 85.60 / 53.98;

/// Side inset of the cutout, in logical pixels.
const double _idFrameSideInset = 24;

/// The cutout sits slightly above the vertical centre so the shutter row and
/// the hint text below it do not crowd the card.
const double _idFrameVerticalBias = 0.42;

/// Corner radius of the cutout, in logical pixels.
const double idFrameCornerRadius = 16;

/// The cutout rectangle for a [viewport]-sized full-screen camera preview.
///
/// Width-driven: the card is as wide as the viewport allows, and its height
/// follows [idCardAspectRatio]. On a very short viewport the height would
/// overflow, so the rect is then height-driven instead and re-centred.
Rect idFrameRect(Size viewport) {
  var width = viewport.width - (_idFrameSideInset * 2);
  var height = width / idCardAspectRatio;

  final maxHeight = viewport.height * 0.55;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * idCardAspectRatio;
  }

  final left = (viewport.width - width) / 2;
  final top = (viewport.height * _idFrameVerticalBias) - (height / 2);
  return Rect.fromLTWH(left, top, width, height);
}
