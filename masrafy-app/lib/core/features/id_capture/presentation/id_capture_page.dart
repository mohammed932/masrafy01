import 'package:auto_route/auto_route.dart';
import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/features/id_capture/id_capture_side.dart';
import 'package:app/core/features/id_capture/id_frame_geometry.dart';
import 'package:app/core/features/id_capture/id_image_crop.dart';
import 'package:app/core/features/id_capture/presentation/widgets/id_frame_overlay.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/utils/image_pick.dart';
import 'package:app/l10n/generated/app_localizations.dart';

export 'package:app/core/features/id_capture/id_capture_side.dart';

/// Opaque backdrop for the camera chrome.
///
/// The capture screen is dark in BOTH themes — it sits over a live sensor feed,
/// so a light surface would wash the preview out and leave white-on-white
/// chrome. `bg.spotlight` is the darkest surface token in either theme; forcing
/// its alpha to 1 keeps it a real background instead of a scrim.
Color cameraSurface(MasrafyColorTheme colors) =>
    colors.bg.spotlight.withValues(alpha: 1);

/// Full-screen framed camera for National-ID capture. The only route-level
/// widget in this file (Principle XXXVI); shared by the apply-documents gate,
/// complete-profile, and profile-edit (Principle XXXV), so it lives under
/// `core/features/` rather than inside one feature.
///
/// Pops a [PickedImage] cropped to the on-screen card cutout, or `null` if the
/// user backs out. The shutter is the commit point: the camera is torn down and
/// the page pops straight away, so the caller's cubit starts the upload without
/// a second confirm tap. Upload stays with the caller — this page never touches
/// a datasource.
///
/// Why a custom camera instead of `ImageSource.camera`: the OS camera gives no
/// aiming guide, so IDs came back rotated, cropped short, or shot from so far
/// away that the number was unreadable at the upload size budget.
@RoutePage()
class IdCapturePage extends StatefulWidget {
  const IdCapturePage({super.key, required this.side});

  final IdCaptureSide side;

  @override
  State<IdCapturePage> createState() => _IdCapturePageState();
}

enum _CaptureStage { starting, ready, busy, failed }

class _IdCapturePageState extends State<IdCapturePage>
    with WidgetsBindingObserver {
  CameraController? _controller;
  _CaptureStage _stage = _CaptureStage.starting;

  /// `true` when the camera failed because permission was refused — that needs
  /// a different message from a device/hardware failure, because retrying
  /// in-app cannot fix it.
  bool _permissionDenied = false;

  /// Set to true when the failure is a capture/crop miss rather than a camera
  /// start-up failure, so the error copy matches what actually went wrong.
  bool _captureFailed = false;

  bool _torchOn = false;

  /// Raw JPEG straight off the sensor, held only so the shot stays on screen
  /// after the camera is released. Drawn with the same `BoxFit.cover` geometry
  /// as the live preview, so the cutout keeps showing the exact region the user
  /// aimed at — a frozen frame instead of a black rectangle or a spinner.
  Uint8List? _frozen;

  /// Size of the preview area that the overlay was painted into. The crop maps
  /// cutout coordinates back through this exact viewport, so it must be the
  /// laid-out size — not `MediaQuery.size`, which ignores any inset the route
  /// may sit under.
  Size _viewport = Size.zero;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _start();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller?.dispose();
    super.dispose();
  }

  /// The OS revokes the camera while the app is backgrounded, so the controller
  /// is torn down on pause and rebuilt on resume. Skipped once the shutter has
  /// fired — the sensor is deliberately stopped there, and a resume must not
  /// bring it back while the shot is still being cropped.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_stage == _CaptureStage.busy) return;
    final controller = _controller;
    if (state == AppLifecycleState.inactive) {
      _controller = null;
      controller?.dispose();
      if (mounted) setState(() => _stage = _CaptureStage.starting);
    } else if (state == AppLifecycleState.resumed && controller == null) {
      _start();
    }
  }

  Future<void> _start() async {
    setState(() {
      _stage = _CaptureStage.starting;
      _permissionDenied = false;
      _captureFailed = false;
    });
    try {
      final cameras = await availableCameras();
      final camera = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );
      final controller = CameraController(
        camera,
        // `veryHigh` (≈1080p) leaves plenty of detail inside the card cutout
        // after cropping, without the multi-second capture latency of `max`.
        ResolutionPreset.veryHigh,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.jpeg,
      );
      await controller.initialize();
      // The frame→image mapping assumes a portrait capture; without this lock
      // a device rotated mid-session returns a landscape frame and the crop
      // lands on the wrong region.
      await controller.lockCaptureOrientation(DeviceOrientation.portraitUp);
      await controller.setFlashMode(FlashMode.off);
      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() {
        _controller = controller;
        _torchOn = false;
        _stage = _CaptureStage.ready;
      });
    } on CameraException catch (e) {
      if (!mounted) return;
      setState(() {
        _permissionDenied = e.code == 'CameraAccessDenied' ||
            e.code == 'CameraAccessDeniedWithoutPrompt' ||
            e.code == 'CameraAccessRestricted';
        _stage = _CaptureStage.failed;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _stage = _CaptureStage.failed);
    }
  }

  Future<void> _toggleTorch() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    final next = !_torchOn;
    try {
      await controller.setFlashMode(next ? FlashMode.torch : FlashMode.off);
      if (mounted) setState(() => _torchOn = next);
    } on CameraException {
      // Torchless device (or the OS refused): leave the toggle where it was
      // rather than lying about the lamp being on.
    }
  }

  Future<void> _capture() async {
    final controller = _controller;
    if (controller == null ||
        !controller.value.isInitialized ||
        _stage != _CaptureStage.ready) {
      return;
    }
    setState(() => _stage = _CaptureStage.busy);
    try {
      final shot = await controller.takePicture();
      final bytes = await shot.readAsBytes();
      if (!mounted) return;
      // Freeze the shot on screen, then release the sensor. Everything below —
      // decoding, cropping, re-encoding — takes seconds on a multi-megapixel
      // JPEG, and leaving the preview streaming through it is what made the
      // camera look like it ignored the shutter. Pinning the still first means
      // the cutout never blanks between the live feed and the frozen frame.
      setState(() => _frozen = bytes);
      await _stopCamera();
      final cropped = await compute(
        cropCapturedIdFrame,
        IdCropRequest(
          bytes: bytes,
          viewport: _viewport,
          frame: idFrameRect(_viewport),
          profile: ImagePickProfile.document,
        ),
      );
      if (!mounted) return;
      // Over-budget after a full-resolution crop is possible on a very wide
      // cutout; treat it like a failed capture rather than popping bytes the
      // upload endpoint would reject.
      if (cropped == null ||
          cropped.length > ImagePickProfile.document.maxBytes) {
        _fail();
        return;
      }
      await context.router.maybePop(
        PickedImage(
          bytes: cropped,
          contentType: 'image/jpeg',
          filename: widget.side.filename,
        ),
      );
    } catch (_) {
      await _stopCamera();
      if (!mounted) return;
      _fail();
    }
  }

  /// Releases the sensor and repaints, so the frozen shot takes over from the
  /// live feed instead of the feed being kept alive behind it.
  Future<void> _stopCamera() async {
    final controller = _controller;
    if (controller == null) return;
    _controller = null;
    if (mounted) setState(() {});
    await controller.dispose();
  }

  void _fail() {
    setState(() {
      _captureFailed = true;
      _stage = _CaptureStage.failed;
    });
  }

  /// Retry after a capture miss: drop the frozen shot and restart the sensor
  /// so the user goes straight back to aiming.
  void _retake() {
    setState(() {
      _captureFailed = false;
      _frozen = null;
      _stage =
          _controller == null ? _CaptureStage.starting : _CaptureStage.ready;
    });
    if (_controller == null) _start();
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);

    return Scaffold(
      backgroundColor: cameraSurface(colors),
      body: LayoutBuilder(
        builder: (context, constraints) {
          _viewport = constraints.biggest;
          return Stack(
            fit: StackFit.expand,
            children: [
              _PreviewLayer(
                controller: _controller,
                frozen: _frozen,
                viewport: _viewport,
              ),
              if (_stage != _CaptureStage.failed)
                IdFrameOverlay(
                  scrimColor: colors.bg.spotlight.withValues(alpha: 0.72),
                  frameColor: colors.white.withValues(alpha: 0.9),
                  accentColor: colors.secondary.main,
                ),
              if (_stage == _CaptureStage.failed)
                _CaptureFailure(
                  permissionDenied: _permissionDenied,
                  captureFailed: _captureFailed,
                  onRetry: _captureFailed ? _retake : _start,
                ),
              _CaptureChrome(
                side: widget.side,
                stage: _stage,
                torchOn: _torchOn,
                torchAvailable: _controller != null,
                onClose: () => context.router.maybePop(),
                onToggleTorch: _toggleTorch,
                onCapture: _capture,
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Live camera feed — or, once the shutter has fired, the frozen shot in its
/// place — sized so it covers the whole viewport.
///
/// `BoxFit.cover` on the sensor's own aspect ratio is what the crop math in
/// [cropCapturedIdFrame] inverts — changing the fit here without changing that
/// function silently misaligns every capture. The frozen still uses the same
/// full-bleed `cover`, so it lands pixel-for-pixel where the live feed was.
class _PreviewLayer extends StatelessWidget {
  const _PreviewLayer({
    required this.controller,
    required this.frozen,
    required this.viewport,
  });

  final CameraController? controller;
  final Uint8List? frozen;
  final Size viewport;

  @override
  Widget build(BuildContext context) {
    final controller = this.controller;
    final frozen = this.frozen;
    final colors = MasrafyColorTheme.of(context);
    if (frozen != null) {
      return Image.memory(frozen, fit: BoxFit.cover, gaplessPlayback: true);
    }
    if (controller == null || !controller.value.isInitialized) {
      return ColoredBox(
        color: cameraSurface(colors),
        child: Center(
          child: SizedBox(
            width: 28.r,
            height: 28.r,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: colors.white.withValues(alpha: 0.7),
            ),
          ),
        ),
      );
    }
    return FittedBox(
      fit: BoxFit.cover,
      child: SizedBox(
        width: viewport.width,
        // `aspectRatio` is reported for the sensor's landscape frame, so in a
        // portrait viewport the preview's height is width × aspectRatio.
        height: viewport.width * controller.value.aspectRatio,
        child: CameraPreview(controller),
      ),
    );
  }
}

/// Top bar (close + title + torch) and bottom bar (hint + shutter).
class _CaptureChrome extends StatelessWidget {
  const _CaptureChrome({
    required this.side,
    required this.stage,
    required this.torchOn,
    required this.torchAvailable,
    required this.onClose,
    required this.onToggleTorch,
    required this.onCapture,
  });

  final IdCaptureSide side;
  final _CaptureStage stage;
  final bool torchOn;
  final bool torchAvailable;
  final VoidCallback onClose;
  final VoidCallback onToggleTorch;
  final VoidCallback onCapture;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final l = AppLocalizations.of(context);

    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: EdgeInsetsDirectional.fromSTEB(8.w, 8.h, 8.w, 0),
            child: Row(
              children: [
                _GlassIconButton(
                  icon: Icons.close_rounded,
                  semanticLabel: l.id_capture_close,
                  onTap: onClose,
                ),
                Expanded(
                  child: Text(
                    side == IdCaptureSide.front
                        ? l.id_capture_title_front
                        : l.id_capture_title_back,
                    textAlign: TextAlign.center,
                    style: text.bodyLarge.copyWith(
                      color: colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (torchAvailable)
                  _GlassIconButton(
                    icon: torchOn
                        ? Icons.flash_on_rounded
                        : Icons.flash_off_rounded,
                    semanticLabel: torchOn
                        ? l.id_capture_torch_off
                        : l.id_capture_torch_on,
                    active: torchOn,
                    onTap: onToggleTorch,
                  )
                else
                  SizedBox(width: 44.r),
              ],
            ),
          ),
          const Spacer(),
          Padding(
            padding: EdgeInsetsDirectional.fromSTEB(24.w, 0, 24.w, 24.h),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  l.id_capture_hint,
                  textAlign: TextAlign.center,
                  style: text.bodySmall.copyWith(
                    color: colors.white.withValues(alpha: 0.85),
                  ),
                ),
                Gap(20.h),
                _ShutterButton(
                  busy: stage == _CaptureStage.busy,
                  onTap: stage == _CaptureStage.ready ? onCapture : null,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ShutterButton extends StatelessWidget {
  const _ShutterButton({required this.busy, required this.onTap});

  final bool busy;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);

    return Semantics(
      button: true,
      label: l.id_capture_shutter,
      child: GestureDetector(
        onTap: busy ? null : onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: 74.r,
          height: 74.r,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: colors.white.withValues(alpha: onTap == null ? 0.4 : 1),
              width: 3,
            ),
          ),
          child: Center(
            child: busy
                ? SizedBox(
                    width: 26.r,
                    height: 26.r,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: colors.white,
                    ),
                  )
                : Container(
                    width: 58.r,
                    height: 58.r,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: colors.white
                          .withValues(alpha: onTap == null ? 0.4 : 1),
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

/// Camera unavailable — permission refused, hardware failure, or a capture that
/// could not be decoded. Replaces the preview so the user is never staring at a
/// black rectangle with no explanation.
class _CaptureFailure extends StatelessWidget {
  const _CaptureFailure({
    required this.permissionDenied,
    required this.captureFailed,
    required this.onRetry,
  });

  final bool permissionDenied;
  final bool captureFailed;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final l = AppLocalizations.of(context);

    final message = captureFailed
        ? l.id_capture_capture_error
        : permissionDenied
            ? l.id_capture_permission_error
            : l.id_capture_error;

    return ColoredBox(
      color: cameraSurface(colors),
      child: Center(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 32.w),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.no_photography_outlined,
                size: 48.r,
                color: colors.white.withValues(alpha: 0.7),
              ),
              Gap(16.h),
              Text(
                message,
                textAlign: TextAlign.center,
                style: text.body.copyWith(
                  color: colors.white.withValues(alpha: 0.85),
                ),
              ),
              Gap(24.h),
              GestureDetector(
                onTap: onRetry,
                behavior: HitTestBehavior.opaque,
                child: Container(
                  padding:
                      EdgeInsets.symmetric(horizontal: 24.w, vertical: 12.h),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(15.r),
                    border:
                        Border.all(color: colors.white.withValues(alpha: 0.6)),
                  ),
                  child: Text(
                    l.id_capture_retry,
                    style: text.body.copyWith(
                      color: colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Translucent round button used for the camera chrome, which sits on a live
/// preview and therefore cannot rely on any theme background for contrast.
class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({
    required this.icon,
    required this.semanticLabel,
    required this.onTap,
    this.active = false,
  });

  final IconData icon;
  final String semanticLabel;
  final VoidCallback onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);

    return Semantics(
      button: true,
      label: semanticLabel,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: 44.r,
          height: 44.r,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: active
                ? colors.secondary.main
                : cameraSurface(colors).withValues(alpha: 0.4),
            border: Border.all(color: colors.white.withValues(alpha: 0.25)),
          ),
          child: Icon(icon, size: 22.r, color: colors.white),
        ),
      ),
    );
  }
}
