import 'package:flutter/material.dart';

import '../controller/drawing_controller.dart';
import '../controller/tool_type.dart';
import '../util/coordinate_transform.dart';
import 'handlers/angle_handler.dart';
import 'handlers/arrow_handler.dart';
import 'handlers/crosshair_handler.dart';
import 'handlers/distance_handler.dart';
import 'handlers/ellipse_handler.dart';
import 'handlers/line_handler.dart';
import 'handlers/perpendicular_handler.dart';
import 'handlers/point_handler.dart';
import 'handlers/select_handler.dart';
import 'handlers/text_handler.dart';
import 'handlers/tool_handler.dart';

/// Top-of-stack `Listener` overlay that owns one handler per mode tool +
/// dispatches raw pointer events through to the active handler after a
/// screen→image coord transform.
///
/// Spec section 3.4: uses `Listener` (zero-latency) — NOT `GestureDetector`.
/// Spec section 3.5: parent wraps this in `IgnorePointer(ignoring: pan-mode)`
/// so the pan gesture falls through to the InteractiveViewer.
class ToolGestureRouter extends StatefulWidget {
  const ToolGestureRouter({
    super.key,
    required this.controller,
    required this.transformationController,
    this.onTextTap,
  });

  final DrawingController controller;
  final TransformationController transformationController;

  /// Fired by the Text handler when the user taps to place a new label. The
  /// parent shows the inline `TextField` overlay at this image-space point.
  final ValueChanged<Offset>? onTextTap;

  @override
  State<ToolGestureRouter> createState() => _ToolGestureRouterState();
}

class _ToolGestureRouterState extends State<ToolGestureRouter> {
  late final Map<ToolType, ToolHandler> _handlers;
  ToolType? _lastTool;

  @override
  void initState() {
    super.initState();
    final c = widget.controller;
    final textHandler = TextHandler(c)
      ..onTapAtImagePoint = (point) => widget.onTextTap?.call(point);
    _handlers = {
      ToolType.select: SelectHandler(c),
      ToolType.line: LineHandler(c),
      ToolType.arrow: ArrowHandler(c),
      ToolType.point: PointHandler(c),
      ToolType.ellipse: EllipseHandler(c),
      ToolType.distance: DistanceHandler(c),
      ToolType.angle: AngleHandler(c),
      ToolType.perpendicular: PerpendicularHandler(c),
      ToolType.text: textHandler,
      ToolType.crosshair: CrosshairHandler(c),
    };
    widget.controller.currentTool.addListener(_onToolChanged);
    widget.controller.cancelTick.addListener(_onCancelSignal);
  }

  void _onToolChanged() {
    final next = widget.controller.currentTool.value;
    if (_lastTool != null && _lastTool != next) {
      _handlers[_lastTool]?.onCancel();
    }
    _lastTool = next;
  }

  void _onCancelSignal() {
    _active?.onCancel();
  }

  @override
  void dispose() {
    widget.controller.currentTool.removeListener(_onToolChanged);
    widget.controller.cancelTick.removeListener(_onCancelSignal);
    super.dispose();
  }

  Offset _toImage(Offset local) =>
      screenToImage(local, widget.transformationController.value);

  ToolHandler? get _active => _handlers[widget.controller.currentTool.value];

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onHover: (e) {
        // Desktop hover only drives the crosshair tool — every other tool
        // ignores hover (touch path uses onPointerDown/Move).
        if (widget.controller.currentTool.value != ToolType.crosshair) return;
        widget.controller.crosshairPosition.value = _toImage(e.localPosition);
      },
      onExit: (_) {
        if (widget.controller.currentTool.value != ToolType.crosshair) return;
        widget.controller.crosshairPosition.value = null;
      },
      child: Listener(
        behavior: HitTestBehavior.opaque,
        onPointerDown: (e) => _active?.onPointerDown(_toImage(e.localPosition)),
        onPointerMove: (e) => _active?.onPointerMove(_toImage(e.localPosition)),
        onPointerUp: (e) => _active?.onPointerUp(_toImage(e.localPosition)),
        onPointerCancel: (e) => _active?.onCancel(),
        child: const SizedBox.expand(),
      ),
    );
  }
}
