import 'package:auto_route/auto_route.dart';
import 'package:flutter/widgets.dart';

import 'package:app/core/features/id_capture/id_capture_side.dart';
import 'package:app/core/router/router.gr.dart';
import 'package:app/core/utils/image_pick.dart';

export 'package:app/core/utils/image_pick.dart' show PickedImage;

/// Opens the framed National-ID camera and returns the cropped image, or
/// `null` if the user backed out.
///
/// One entry point for all three ID surfaces (apply-documents,
/// complete-profile, profile-edit) so they cannot drift on which route, which
/// side enum, or which result type they use — the screens differ only in which
/// cubit receives the bytes.
Future<PickedImage?> captureNationalId(
  BuildContext context, {
  required bool front,
}) {
  return context.router.push<PickedImage>(
    IdCaptureRoute(side: front ? IdCaptureSide.front : IdCaptureSide.back),
  );
}
